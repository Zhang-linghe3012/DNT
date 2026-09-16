import { NextRequest, NextResponse } from "next/server";
import {
  generateImage,
  resolveImageProvider,
} from "@/lib/chatbot/image";

export async function POST(request: NextRequest) {
  try {
    let payload: { prompt?: string; provider?: string; size?: string };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "Payload không hợp lệ." }, { status: 400 });
    }

    const prompt = payload.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "Thiếu tham số prompt." }, { status: 400 });
    }

    const provider = resolveImageProvider(payload.provider);
    if (!provider) {
      return NextResponse.json(
        { error: "Provider không hợp lệ." },
        { status: 400 }
      );
    }

    if (provider === "dall-e" && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Thiếu OPENAI_API_KEY để dùng DALL-E." },
        { status: 500 }
      );
    }

    const size =
      payload.size === "1024x1792" || payload.size === "1792x1024"
        ? payload.size
        : "1024x1024";

    const image = await generateImage(prompt, provider, size);

    if (!image) {
      return NextResponse.json(
        { error: "Không thể sinh hình minh họa." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      image: image.imageBase64,
      mimeType: image.mimeType,
      provider,
      prompt: image.prompt,
    });
  } catch (error) {
    console.error("[image] Lỗi API sinh ảnh:", error);
    return NextResponse.json({ error: "Lỗi server." }, { status: 500 });
  }
}