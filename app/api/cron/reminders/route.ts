import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET;

import { checkDueReminders } from "@/lib/chatbot/reminders";

export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get("authorization");
    if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sent = await checkDueReminders();
    return NextResponse.json({
      sent: sent.length,
      reminders: sent.map((r) => ({ patientId: r.patientId, kind: r.kind })),
    });
  } catch (error) {
    console.error("[cron] Lỗi khi chạy bộ nhắc:", error);
    return NextResponse.json({ error: "Lỗi server." }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";