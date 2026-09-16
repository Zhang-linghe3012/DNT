import { NextRequest, NextResponse } from "next/server";
import { generateSkinIllustration } from "@/lib/chatbot/image";

export async function POST(request: NextRequest) {
  try {
    let payload: { prompt?: string };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
    }

    const prompt = payload.prompt?.trim();
    if (!prompt) {
      return NextResponse.json(
        { error: "Thiếu tham số prompt." },
        { status: 400 }
      );
    }

    const image = await generateSkinIllustration(prompt);
    if (!image) {
      return NextResponse.json(
        { error: "Không thể sinh hình minh họa." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: image.imageBase64,
      mimeType: image.mimeType,
      prompt: image.prompt,
    });
  } catch (error) {
    console.error("[image] Lỗi API sinh ảnh:", error);
    return NextResponse.json({ error: "Lỗi server." }, { status: 500 });
  }
}