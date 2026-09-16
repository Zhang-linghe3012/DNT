import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerationConfig } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY ?? process.env.CHATBOT_API_KEY;
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image";

const GENERATION_CONFIG = {
  responseModalities: ["TEXT", "IMAGE"],
} as unknown as GenerationConfig;

export interface GeneratedImage {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

export function buildIllustrationPrompt(description: string): string {
  return `Vẽ minh họa y khoa da liễu, rõ ràng, sinh động, có chú thích tiếng Việt: ${description}. Không chèn văn bản nhạy cảm, phù hợp tham khảo giáo dục sức khỏe.`;
}

export async function generateSkinIllustration(
  description: string
): Promise<GeneratedImage | null> {
  if (!API_KEY) {
    console.error("[image] Thiếu GEMINI_API_KEY.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: IMAGE_MODEL,
      generationConfig: GENERATION_CONFIG,
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: buildIllustrationPrompt(description) }],
        },
      ],
    });

    const candidate = result.response.candidates?.[0];
    const imagePart = candidate?.content.parts.find(
      (part) => "inlineData" in part && part.inlineData
    ) as
      | { inlineData: { mimeType: string; data: string } }
      | undefined;

    if (!imagePart) {
      console.error("[image] Model sinh ảnh không trả về inline image.");
      return null;
    }

    return {
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType,
      prompt: description,
    };
  } catch (error) {
    console.error("[image] Lỗi khi sinh hình minh họa:", error);
    return null;
  }
}

const OPENAI_IMAGE_API = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "dall-e-3";

export type ImageProvider = "gemini" | "dall-e";

const IMAGE_INTENT_PATTERN =
  /(mô phỏng|mo phong|vẽ hình|ve hinh|vẽ một|ve mot|vẽ sơ đồ|ve so do|vẽ |ve |tạo hình ảnh|tao hinh anh|sinh ảnh|sinh anh|minh họa|minh hoa|hình minh họa|hinh minh hoa|trực quan hóa|truc quan hoa|draw|visuali(s|z)e|illustrat|generate image|create image|simulate)/i;

const IMAGE_INTENT_WORDS =
  /(vui lòng hãy |hãy |nhờ bạn |bạn có thể |giúp tôi |cho tôi )?(mô phỏng|mo phong|vẽ hình ảnh|ve hinh anh|vẽ hình|ve hinh|vẽ một hình|ve mot hinh|vẽ sơ đồ|ve so do|vẽ |ve |tạo hình ảnh|tao hinh anh|sinh ảnh|sinh anh|minh họa|minh hoa|hình minh họa|hinh minh hoa|trực quan hóa|truc quan hoa|giúp tôi vẽ|ve giup toi|draw|visuali(s|z)e|illustrat|generate image|create image|simulate)[.:,]?\s*/i;

export interface ImageIntent {
  description: string;
}

export function detectImageRequest(text: string): ImageIntent | null {
  if (!IMAGE_INTENT_PATTERN.test(text)) {
    return null;
  }
  const description = text
    .replace(IMAGE_INTENT_WORDS, "")
    .replace(/^,|^:|^\.|\s*[?？.。!！]+$/g, "")
    .trim();

  return { description };
}

export function resolveImageProvider(requested?: string): ImageProvider | null {
  if (requested === "dall-e" || requested === "openai") {
    return "dall-e";
  }
  if (requested === "gemini") {
    return "gemini";
  }
  if (requested === undefined) {
    return process.env.OPENAI_API_KEY ? "dall-e" : "gemini";
  }
  return null;
}

export async function generateImage(
  description: string,
  provider?: string,
  size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024"
): Promise<GeneratedImage | null> {
  const resolved = resolveImageProvider(provider);
  return resolved === "dall-e"
    ? generateDallEImage(description, size)
    : generateSkinIllustration(description);
}

export async function generateDallEImage(
  description: string,
  size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024"
): Promise<GeneratedImage | null> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) {
    console.error("[image] Thiếu OPENAI_API_KEY cho DALL-E.");
    return null;
  }

  try {
    const res = await fetch(OPENAI_IMAGE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: buildIllustrationPrompt(description),
        n: 1,
        size,
        response_format: "b64_json",
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("[image] DALL-E trả về lỗi:", res.status, data?.error?.message ?? "");
      return null;
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      console.error("[image] DALL-E không trả về b64_json.");
      return null;
    }

    return {
      imageBase64: b64,
      mimeType: "image/png",
      prompt: description,
    };
  } catch (error) {
    console.error("[image] Lỗi khi gọi DALL-E:", error);
    return null;
  }
}