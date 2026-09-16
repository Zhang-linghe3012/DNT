import { supabase } from "@/lib/supabase/server";
import {
  extractTimingSlots,
  type Prescription,
  type TimingSlot,
} from "@/lib/chatbot/patient";

export type ReminderKind = "medication" | "weekly_checkin";

export interface Reminder {
  id: string;
  patientId: string;
  dueAt: string;
  message: string;
  kind: ReminderKind;
  status: "pending" | "sent" | "failed";
}

const memoryStore = new Map<string, Reminder>();

function toDueAt(date: Date): string {
  return date.toISOString();
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export async function saveReminder(reminder: Reminder): Promise<void> {
  try {
    const { error } = await supabase().from("medication_reminders").insert({
      patient_id: reminder.patientId,
      due_at: reminder.dueAt,
      message: reminder.message,
      kind: reminder.kind,
      status: reminder.status,
    });
    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("[reminders] Không lưu nhắc vào Supabase (dùng bộ nhớ tạm):", error);
    memoryStore.set(reminder.id, reminder);
  }
}

function buildMedicationReminders(
  prescription: Prescription,
  kind: ReminderKind
): Reminder[] {
  const slots: TimingSlot[] = extractTimingSlots(prescription);
  const days = prescription.treatmentDays ?? 7;
  const reminders: Reminder[] = [];
  const now = new Date();

  for (let day = 0; day < days; day += 1) {
    for (const slot of slots) {
      const hourMatch = slot.time.match(/^(\d{1,2}):(\d{2})/);
      if (!hourMatch) {
        continue;
      }
      const dueAt = addHours(
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + day,
          Number(hourMatch[1]),
          Number(hourMatch[2])
        ),
        0
      );
      reminders.push({
        id: `${prescription.patientId}-${kind}-${day}-${slot.time.replace(/[^0-9]/g, "")}`,
        patientId: prescription.patientId,
        dueAt: toDueAt(dueAt),
        message: `[Nhắc uống thuốc] Đến giờ uống: ${slot.medications.join(", ")}.`,
        kind,
        status: "pending",
      });
    }
  }
  return reminders;
}

export async function createMedicationReminders(
  prescription: Prescription
): Promise<Reminder[]> {
  const reminders = buildMedicationReminders(prescription, "medication");
  for (const reminder of reminders) {
    await saveReminder(reminder);
  }
  console.info(
    `[reminders] Đã tạo ${reminders.length} nhắc uống thuốc cho bệnh nhân ${prescription.patientId}.`
  );
  return reminders;
}

export async function createWeeklyCheckIn(patientId: string): Promise<Reminder> {
  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const reminder: Reminder = {
    id: `${patientId}-weekly-checkin-${Date.now()}`,
    patientId,
    dueAt: toDueAt(dueAt),
    message: "[Hỏi thăm hàng tuần] Sau một tuần điều trị, tình trạng da của bạn thế nào rồi? Hãy kể triệu chứng để tôi tư vấn tiếp nhé.",
    kind: "weekly_checkin",
    status: "pending",
  };
  await saveReminder(reminder);
  console.info(`[reminders] Đã lên lịch hỏi thăm hàng tuần cho bệnh nhân ${patientId} vào ${dueAt.toLocaleString("vi-VN")}.`);
  return reminder;
}

async function notifyPatient(reminder: Reminder): Promise<void> {
  console.info(`[notify] ${reminder.patientId} ← ${reminder.message}`);
  try {
    const { error } = await supabase().from("notifications").insert({
      patient_id: reminder.patientId,
      content: reminder.message,
      kind: reminder.kind,
      scheduled_at: reminder.dueAt,
    });
    if (error) {
      console.error("[notify] Không ghi notification vào Supabase:", error.message);
    }
  } catch {
    console.error("[notify] Không ghi notification do thiếu cấu hình Supabase.");
  }
}

export async function checkDueReminders(): Promise<Reminder[]> {
  const now = new Date().toISOString();
  const due: Reminder[] = [];

  for (const reminder of memoryStore.values()) {
    if (reminder.status === "pending" && reminder.dueAt <= now) {
      due.push(reminder);
    }
  }

  try {
    const { data, error } = await supabase()
      .from("medication_reminders")
      .select("*")
      .eq("status", "pending")
      .lte("due_at", now);
    if (!error && data) {
      for (const row of data) {
        due.push({
          id: row.id,
          patientId: row.patient_id,
          dueAt: row.due_at,
          message: row.message,
          kind: row.kind,
          status: "pending",
        });
      }
    } else if (error && error.code !== "PGRST116") {
      console.error("[reminders] Không truy vấn được nhắc từ Supabase:", error.message);
    }
  } catch (error) {
    console.error("[reminders] Lỗi truy vấn nhắc từ Supabase:", error);
  }

  for (const reminder of due) {
    await notifyPatient(reminder);
    reminder.status = "sent";
    const stored = memoryStore.get(reminder.id);
    if (stored) {
      memoryStore.set(reminder.id, { ...reminder });
    }
    try {
      await supabase()
        .from("medication_reminders")
        .update({ status: "sent" })
        .eq("id", reminder.id);
    } catch {
      // bỏ qua nếu chưa có bảng
    }
  }

  return due;
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startReminderScheduler(intervalMs = 60_000): void {
  if (schedulerTimer) {
    return;
  }
  schedulerTimer = setInterval(() => {
    checkDueReminders().catch((error) =>
      console.error("[reminders] Scheduler lỗi:", error)
    );
  }, intervalMs);
  console.info(`[reminders] Bộ lập lịch nhắc thuốc khởi động (mỗi ${Math.round(intervalMs / 1000)} giây).`);
}

export function stopReminderScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}