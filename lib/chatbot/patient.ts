import { readFileSync } from "node:fs";
import { join } from "node:path";
import { supabase } from "@/lib/supabase/server";

export interface Medication {
  name: string;
  usage: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  effect: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName?: string;
  condition?: string;
  issuedAt?: string;
  treatmentDays?: number;
  medications: Medication[];
}

const DEMO_PRESCRIPTIONS_PATH = join(
  process.cwd(),
  "data",
  "demo-prescriptions.json"
);

export function getDemoPrescriptions(): Prescription[] {
  try {
    return JSON.parse(readFileSync(DEMO_PRESCRIPTIONS_PATH, "utf-8"));
  } catch {
    return [];
  }
}

export async function getPrescriptionByPatient(
  patientId: string
): Promise<Prescription | null> {
  if (!patientId) {
    return null;
  }

  try {
    const { data, error } = await supabase()
      .from("patient_prescriptions")
      .select("*")
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[patient] Không truy xuất được đơn thuốc từ Supabase:", error.message);
      return getDemoPrescription(patientId);
    }

    if (data) {
      return {
        id: data.id,
        patientId: data.patient_id,
        patientName: data.patient_name,
        condition: data.condition,
        issuedAt: data.issued_at,
        treatmentDays: data.treatment_days,
        medications: data.medications ?? [],
      };
    }
  } catch (error) {
    console.error("[patient] Lỗi khi truy xuất đơn thuốc:", error);
  }

  return getDemoPrescription(patientId);
}

function getDemoPrescription(patientId: string): Prescription | null {
  const demos = getDemoPrescriptions();
  return (
    demos.find((p) => p.patientId === patientId) ??
    demos.find((p) => p.patientId === "DEMO_PATIENT") ??
    null
  );
}

export type TimingSlot = {
  time: string;
  medications: string[];
};

export function extractTimingSlots(prescription: Prescription): TimingSlot[] {
  const slots = new Map<string, string[]>();
  for (const med of prescription.medications) {
    const times = med.timing
      .split(/[;,，、]/)
      .map((t) => t.trim())
      .filter(Boolean);
    for (const time of times) {
      const list = slots.get(time) ?? [];
      list.push(med.name);
      slots.set(time, list);
    }
  }
  return Array.from(slots.entries()).map(([time, medications]) => ({
    time,
    medications,
  }));
}

export function formatPrescription(prescription: Prescription): string {
  const lines: string[] = [`Đơn thuốc: ${prescription.id}`];
  if (prescription.patientName) {
    lines.push(`Bệnh nhân: ${prescription.patientName} (${prescription.patientId})`);
  }
  if (prescription.condition) {
    lines.push(`Chẩn đoán: ${prescription.condition}`);
  }
  if (prescription.issuedAt) {
    lines.push(`Ngày kê: ${prescription.issuedAt}`);
  }
  if (prescription.treatmentDays) {
    lines.push(`Liệu trình: ${prescription.treatmentDays} ngày`);
  }
  lines.push("");
  prescription.medications.forEach((med, index) => {
    lines.push(
      `${index + 1}. ${med.name} — dạng dùng: ${med.usage}; liều: ${med.dosage}; tần suất: ${med.frequency}; thời điểm: ${med.timing}; thời gian: ${med.duration}.`
    );
    lines.push(`   Công dụng: ${med.effect}`);
  });
  return lines.join("\n");
}