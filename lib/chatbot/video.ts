import { GoogleGenAI } from "@google/genai";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const API_KEY = process.env.GEMINI_API_KEY ?? process.env.CHATBOT_API_KEY;
const VIDEO_MODEL = process.env.GEMINI_VIDEO_MODEL ?? "veo-3.1-fast-generate-001";
const VIDEO_POLL_INTERVAL_MS = 10_000;
const VIDEO_POLL_MAX_ROUNDS = 30;

const GENERATED_DIR = join(process.cwd(), "public", "generated");

export interface GeneratedVideo {
  url: string;
  mimeType: string;
  prompt: string;
}

export interface VideoIntent {
  description: string;
  productName?: string;
}

const VIDEO_INTENT_PATTERN =
  /(video|clip xem|clip mô|đoạn phim|dựng hình|chiếu hình) |quá trình (phục hồi|hồi phục)|tiến trình (phục hồi|hồi phục)|phục hồi da|da phục hồi|da hồi phục|(mô phỏng|mô tả|minh họa) .{0,50}(phục hồi|hồi phục) |recovery (video|simulation)|skin recovery/i;

const VIDEO_INTENT_WORDS =
  /(vui lòng |hãy |nhờ bạn |bạn có thể |giúp tôi |cho tôi |cho mình |tạo |dựng |làm |sinh |chiếu |xem )+(video|clip|đoạn phim|phim) |(mô phỏng|mô tả|simulate|simulation) |(quá trình|tiến trình) (phục hồi|hồi phục) |(phục hồi da|da phục hồi|da hồi phục) /gi;

const PRODUCT_NAME_PATTERN =
  /(?:sản phẩm|serum|sữa rửa mặt|kem chống nắng|kem dưỡng|kem|toner|tinh chất|essence|dưỡng ẩm|mỹ phẩm)\s+([A-Za-z0-9][A-Za-z0-9 .\-/]{1,40}?)(?=[,;.!?\n]| khi | để | giúp | dùng | với | cải thiện | hết | hết mụn |$)/i;

export function extractProductName(text: string): string | undefined {
  const match = text.match(PRODUCT_NAME_PATTERN);
  if (!match) {
    return undefined;
  }
  const name = match[1].trim().replace(/\s+$/, "");
  return name.length > 0 && name.length <= 40 ? name : undefined;
}

export function detectVideoRequest(text: string): VideoIntent | null {
  if (!VIDEO_INTENT_PATTERN.test(text)) {
    return null;
  }
  const description = text
    .replace(VIDEO_INTENT_WORDS, "")
    .replace(/^[,:.\-–\s]+|[,;.!?…\s]+$/g, "")
    .trim();

  return {
    description: description || text,
    productName: extractProductName(text),
  };
}

export function buildRecoveryVideoPrompt(description: string): string {
  return `Video mô phỏng y khoa da liễu về tiến trình phục hồi làn da theo thời gian. Bối cảnh: ${description || "làn da bị mẩn đỏ, kích ứng"}. Diễn biến: giai đoạn đầu da mẩn đỏ, tổn thương nhẹ, bong tróc; giai đoạn giữa giảm đỏ, bắt đầu cấp ẩm, mềm mịn; giai đoạn cuối da căng mịn, đều màu, khỏe mạnh. Phong cách minh họa y tế sạch sẽ, sinh động, không logo, không watermark, không nội dung nhạy cảm.`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveVideoBytes(video: {
  uri?: string;
  videoBytes?: string;
}): Promise<Buffer | null> {
  if (video.videoBytes) {
    return Buffer.from(video.videoBytes, "base64");
  }
  const uri = video.uri;
  if (!uri) {
    return null;
  }
  const url = uri.startsWith("http")
    ? uri
    : `https://generativelanguage.googleapis.com/v1beta/${uri.replace(/^\/+/, "")}`;
  const headers: Record<string, string> = {};
  if (API_KEY) {
    headers["x-goog-api-key"] = API_KEY;
  }
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error("[video] Download video thất bại:", res.status, res.statusText);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    console.error("[video] Lỗi download video:", error);
    return null;
  }
}

function persistVideo(buffer: Buffer, mimeType: string): string | null {
  try {
    mkdirSync(GENERATED_DIR, { recursive: true });
    const ext = mimeType.includes("webm")
      ? "webm"
      : mimeType.includes("quicktime")
        ? "mov"
        : mimeType.includes("ogg")
          ? "ogv"
          : "mp4";
    const fileName = `skin-recovery-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    writeFileSync(join(GENERATED_DIR, fileName), buffer);
    return `/generated/${fileName}`;
  } catch (error) {
    console.error("[video] Lưu video thất bại:", error);
    return null;
  }
}

export async function generateRecoveryVideo(
  prompt: string
): Promise<GeneratedVideo | null> {
  if (!API_KEY) {
    console.error("[video] Thiếu GEMINI_API_KEY.");
    return null;
  }

  let ai: GoogleGenAI;
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    console.error("[video] Khởi tạo GoogleGenAI thất bại:", error);
    return null;
  }

  try {
    let operation = await ai.models.generateVideos({
      model: VIDEO_MODEL,
      prompt,
      config: {
        numberOfVideos: 1,
        aspectRatio: "16:9",
        durationSeconds: 8,
        negativePrompt: "văn bản dài, logo, watermark, nội dung nhạy cảm",
      },
    });

    for (let round = 0; round < VIDEO_POLL_MAX_ROUNDS && !operation.done; round += 1) {
      await wait(VIDEO_POLL_INTERVAL_MS);
      operation = await ai.operations.get({ operation });
    }

    if (!operation.done) {
      console.error("[video] Quá thời gian chờ sinh video.");
      return null;
    }
    if (operation.error) {
      console.error("[video] Operation gặp lỗi:", operation.error);
      return null;
    }

    const generated = operation.response?.generatedVideos?.[0];
    const video = generated?.video;
    if (!video) {
      console.error("[video] Không nhận được video từ API.");
      return null;
    }

    const mimeType = video.mimeType ?? "video/mp4";
    const buffer = await resolveVideoBytes(video);
    if (!buffer) {
      return null;
    }

    const url = persistVideo(buffer, mimeType);
    return url ? { url, mimeType, prompt } : null;
  } catch (error) {
    console.error("[video] Lỗi sinh video:", error);
    return null;
  }
}