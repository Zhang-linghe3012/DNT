import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenerativeAI, FunctionCallingMode, SchemaType } from "@google/generative-ai";
import type { Tool, Content } from "@google/generative-ai";
import type { ChatMessage } from "@/lib/chatbot/types";
import { findOrCreateConversation, saveMessage } from "@/lib/chatbot/storage";
import {
  getPrescriptionByPatient,
  formatPrescription,
  type Prescription,
} from "@/lib/chatbot/patient";
import {
  createMedicationReminders,
  createWeeklyCheckIn,
} from "@/lib/chatbot/reminders";
import {
  generateImage,
  detectImageRequest,
  type GeneratedImage,
} from "@/lib/chatbot/image";
import {
  buildRecoveryVideoPrompt,
  detectVideoRequest,
  generateRecoveryVideo,
} from "@/lib/chatbot/video";

const API_KEY = process.env.GEMINI_API_KEY ?? process.env.CHATBOT_API_KEY;
const MODEL = "gemini-3.6-flash";
const ACTIVE_PATIENT_ID =
  process.env.DEMO_PATIENT_ID ?? "DEMO_PATIENT";
const MAX_TOOL_ROUNDS = 4;

const KB_PATH = join(process.cwd(), "data", "dermatology-kb.json");
const MAX_KB_CHARS = 150000;

let dermatologyKB: { source?: string; title: string; content: string }[] = [];
try {
  dermatologyKB = JSON.parse(readFileSync(KB_PATH, "utf-8"));
  dermatologyKB.sort((a, b) => {
    const aIsDocx = /\.docx$/i.test(a.source ?? "");
    const bIsDocx = /\.docx$/i.test(b.source ?? "");
    return aIsDocx === bIsDocx ? b.content.length - a.content.length : aIsDocx ? -1 : 1;
  });
} catch {
  console.warn("[chat] Không tìm thấy dermatology-kb.json — chatbot sẽ trả lời không có tài liệu tham chiếu.");
}

function buildKB(charsBudget: number): string {
  let parts: string[] = [];
  let used = 0;
  for (let i = 0; i < dermatologyKB.length; i += 1) {
    const doc = dermatologyKB[i];
    const header = `--- Tài liệu ${i + 1}: ${doc.title} ---\n`;
    const headerLen = header.length;
    let content = doc.content;
    if (used + headerLen + content.length > charsBudget) {
      const remaining = charsBudget - used - headerLen;
      if (remaining > 1000) {
        content = doc.content.slice(0, remaining);
        console.info(`[chat] Tài liệu "${doc.title}" bị cắt còn ${remaining} ký tự do giới hạn token.`);
      } else {
        break;
      }
    }
    parts.push(header + content);
    used += headerLen + content.length;
  }
  console.info(`[chat] SystemInstruction chứa ${used} ký tự tài liệu tham chiếu (${dermatologyKB.length} tài liệu).`);
  return parts.join("\n\n");
}

const SYSTEM_INSTRUCTION = `Bạn là trợ lý AI "Chuyên gia Tư vấn Da liễu" của website Việt Nam.
Tông giọng: Lịch sự, Chuyên nghiệp, Ấm áp và Khoa học. Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu.

===== PHÂN LUỒNG XỬ LÝ CÂU HỎI =====

1. Khi người dùng hỏi về SẢN PHẨM BÔI NGOÀI DA / MỸ PHẨM (ví dụ: Serum Torriden, Sữa rửa mặt Simple, kem dưỡng ẩm, toner BHA Obagi...):
   - Dù tài liệu tham chiếu không đề cập tên thương hiệu, bạn VẪN ĐƯỢC PHÉP dùng tri thức da liễu sẵn có để tư vấn đầy đủ theo cấu trúc chuyên gia:
     * Thông tin chung & Hoạt chất chính của sản phẩm (ví dụ: HA, B5, Niacinamide...).
     * Công dụng nổi bật đối với làn da.
     * Hướng dẫn cách dùng đúng chuẩn y khoa (thứ tự dùng, tần suất).
     * Loại da phù hợp / Lưu ý khi dùng; Hạn sử dụng thông thường sau khi mở nắp (PAO).
   - TUYỆT ĐỐI KHÔNG từ chối bằng các câu máy móc kiểu: "Hiện tại tôi chưa có thông tin trong tài liệu tham chiếu" hoặc "Rất tiếc trong tài liệu tham chiếu không có thông tin".
   - KHÔNG cung cấp hoặc đề cập thông tin về GIÁ CẢ sản phẩm dưới mọi hình thức.

2. Khi người dùng hỏi về BỆNH LÝ DA LIỄU (mụn, vảy nến, viêm da, zona, tổn thương da...):
   - BẮT BUỘC tra cứu và dựa vào kiến thức trong tài liệu y khoa đã nạp (data/dermatology-kb.json) để trả lời về nguyên nhân, triệu chứng và hướng chăm sóc.
   - KHÔNG tự ý ngoại suy hoặc chẩn đoán thay bác sĩ cho các bệnh lý chưa có trong tài liệu.

3. Khi triệu chứng được mô tả có dấu hiệu nghiêm trọng (lan rộng, chảy mủ, sốt cao, đau dữ dội, sưng mặt, ngứa toàn thân nặng), LUÔN khuyên người dùng đi khám bác sĩ chuyên khoa Da liễu ngay và không tự ý chẩn đoán.

===== HÀNG RÀO AN TOÀN Y TẾ (CỰC KỲ QUAN TRỌNG) =====
4. CẤM TUYỆT ĐỐI tự ý kê đơn hoặc tư vấn sử dụng các loại THUỐC KHÁNG SINH (uống hoặc bôi như Clindamycin, Erythromycin, Metronidazole, Tretinoin/Isotretinoin, BPO nồng độ kê đơn...) và các thuốc kê đơn chuyên sâu.
5. CHỈ ĐƯỢC PHÉP khuyên dùng các sản phẩm chăm sóc da bôi ngoài không kê đơn (OTC) dịu nhẹ như: Sữa rửa mặt dịu nhẹ, Dưỡng ẩm (B5, HA), Kẽm (Zinc), Niacinamide, Kem chống nắng.
6. Nếu người dùng hỏi về thuốc kháng sinh hoặc bệnh lý cần kháng sinh, bắt buộc phản hồi với tinh thần: "Kháng sinh là thuốc kê đơn cần có chỉ định trực tiếp từ Bác sĩ chuyên khoa Da liễu sau khi khám lâm sàng. Bạn không nên tự ý sử dụng" và nhắc họ đến thăm khám trực tiếp.

===== PHONG CÁCH HỘI THOẠI =====
7. QUY TẮC ĐÂM THẲNG VÀO CÂU HỎI CHÍNH: Vào thẳng nội dung tư vấn ngay ở dòng đầu tiên. CHỈ trả lời duy nhất câu hỏi MỚI NHẤT của người dùng. CẤM TUYỆT ĐỐI lặp lại câu hỏi của người dùng, CẤM chào hỏi dài dòng, CẤM nhắc lại/tóm tắt/liệt kê lại các câu hỏi hoặc câu trả lời ở các tin nhắn trước.
8. QUY TẮC LƯU TRỮ NGỮ CẢNH THẦM LẶNG: Âm thầm ghi nhớ tất cả thông tin cá nhân/da liễu mà người dùng đã đề cập (độ tuổi, loại da, tiền sử dị ứng, vấn đề đang gặp, các sản phẩm đã hỏi...). Chỉ dùng những thông tin đã nhớ làm ngữ cảnh để tư vấn chính xác cho câu hỏi hiện tại; KHÔNG ĐƯỢC tự ý viết ra các câu dẫn kiểu "Như bạn đã nói ở trên...", "Dựa vào thông tin bạn cung cấp trước đó...", "Dựa vào câu hỏi trước của bạn...", "Về vấn đề X bạn vừa hỏi...".
9. Trả lời ngắn gọn, súc tích, chuẩn y khoa, thân thiện. Luôn nhấn mạnh đây chỉ là thông tin tham khảo, không thay thế tư vấn của bác sĩ.`;

const KB_SECTION = dermatologyKB.length
  ? `\n\n===== TÀI LIỆU THAM CHIẾU =====\n` + buildKB(MAX_KB_CHARS)
  : "";

const FULL_SYSTEM_INSTRUCTION = SYSTEM_INSTRUCTION + KB_SECTION;

const TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_patient_prescription",
        description:
          "Truy xuất đơn thuốc hiện tại của bệnh nhân đang trò chuyện từ hệ thống Quản lý bệnh nhân. Gọi khi người dùng hỏi về đơn thuốc, liều dùng, thời gian uống, hoặc công dụng thuốc.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            patientId: {
              type: SchemaType.STRING,
              description: "Mã bệnh nhân (nếu người dùng cung cấp).",
            },
          },
        },
      },
      {
        name: "schedule_medication_reminders",
        description:
          "Tạo lịch nhắc uống thuốc theo từng thời điểm trong đơn thuốc của bệnh nhân và lên lịch hỏi thăm hàng tuần. Gọi khi người dùng yêu cầu nhắc uống thuốc hoặc muốn được theo dõi.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            patientId: {
              type: SchemaType.STRING,
              description: "Mã bệnh nhân.",
            },
          },
        },
      },
      {
        name: "visualize_skin_condition",
        description:
          "Sinh hình ảnh minh họa y khoa về tổn thương da, tác hại tia UV lên cấu trúc da, hoặc diễn tiến phục hồi da khi người dùng yêu cầu trực quan hóa thông tin.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            description: {
              type: SchemaType.STRING,
              description: "Mô tả nội dung cần minh họa.",
            },
          },
          required: ["description"],
        },
      },
    ],
  },
];

interface CollectedImage {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  activePatientId: string,
  images: CollectedImage[]
): Promise<string> {
  switch (name) {
    case "get_patient_prescription": {
      const prescription = await getPrescriptionByPatient(activePatientId);
      if (!prescription) {
        return "Không tìm thấy đơn thuốc cho bệnh nhân này.";
      }
      return formatPrescription(prescription);
    }
    case "schedule_medication_reminders": {
      const prescription: Prescription | null =
        await getPrescriptionByPatient(activePatientId);
      if (!prescription) {
        return "Không có đơn thuốc để lập lịch nhắc uống thuốc.";
      }
      const reminders = await createMedicationReminders(prescription);
      await createWeeklyCheckIn(activePatientId);
      return `Đã tạo ${reminders.length} mốc nhắc uống thuốc theo giờ trong đơn và 1 lịch hỏi thăm hàng tuần cho bệnh nhân.`;
    }
    case "visualize_skin_condition": {
      const description = String(args.description ?? "");
      const generated = await generateImage(description);
      if (!generated) {
        return "Không thể sinh hình minh họa lúc này (lỗi dịch vụ ảnh).";
      }
      images.push(generated);
      return "Đã sinh hình minh họa thành công; ảnh sẽ được gửi kèm cho người dùng.";
    }
    default:
      return `Không hỗ trợ công cụ: ${name}`;
  }
}

function buildVideoReply(product?: string): string {
  const subject = product
    ? `khi dùng **${product}**`
    : "khi chăm sóc và phục hồi da đúng cách";
  return `Đây là video mô phỏng tiến trình phục hồi da ${subject}:\n\n- Giai đoạn đầu: da còn mẩn đỏ, kích ứng, tổn thương nhẹ.\n- Giai đoạn giữa: da giảm đỏ, được cấp ẩm, mềm mịn hơn.\n- Giai đoạn cuối: hàng rào da phục hồi, căng mịn, đều màu, khỏe mạnh.\n\nHướng dẫn ngắn: dùng đều đặn mỗi ngày theo đúng quy trình (làm sạch dịu nhẹ → dưỡng ẩm → kem chống nắng buổi sáng). Kết quả thường cần từ 2–4 tuần; nếu da không cải thiện hoặc tình trạng nặng hơn, bạn nên đến khám bác sĩ chuyên khoa Da liễu.`;
}

function toGeminiContents(messages: ChatMessage[]): Content[] {
  return messages.map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.content }],
  }));
}

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      console.error(
        "[chat] Thiếu biến môi trường GEMINI_API_KEY (hoặc CHATBOT_API_KEY)."
      );
      return NextResponse.json(
        { error: "Thiếu biến môi trường GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    let payload: {
      conversationId?: string;
      patientId?: string;
      messages?: ChatMessage[];
    };
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Payload không hợp lệ." },
        { status: 400 }
      );
    }

    const messages = payload.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Payload không hợp lệ." },
        { status: 400 }
      );
    }

    const conversationId = await findOrCreateConversation(
      payload.conversationId
    );
    const activePatientId = payload.patientId ?? ACTIVE_PATIENT_ID;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === "user") {
      await saveMessage(conversationId, lastMessage);
    }

    if (lastMessage.role === "user") {
      const videoIntent = detectVideoRequest(lastMessage.content);
      if (videoIntent) {
        console.info(
          `[chat] Phát hiện yêu cầu video mô phỏng: "${videoIntent.description}"`
        );
        const generated = await generateRecoveryVideo(
          buildRecoveryVideoPrompt(videoIntent.description)
        );
        if (generated) {
          const replyText = buildVideoReply(videoIntent.productName);
          await saveMessage(conversationId, {
            role: "assistant",
            content: replyText,
          });
          return NextResponse.json({
            response: replyText,
            conversationId,
            videos: [generated],
          });
        }
        console.error(
          "[chat] Không sinh được video, chuyển sang trả lời bằng văn bản."
        );
      }
    }

    if (lastMessage.role === "user") {
      const imageIntent = detectImageRequest(lastMessage.content);
      if (imageIntent && imageIntent.description) {
        console.info(
          `[chat] Phát hiện yêu cầu sinh ảnh: "${imageIntent.description}"`
        );
        const generated = await generateImage(imageIntent.description);
        if (generated) {
          const replyText = `Đây là hình minh họa cho: ${imageIntent.description}.`;
          await saveMessage(conversationId, {
            role: "assistant",
            content: replyText,
          });
          return NextResponse.json({
            response: replyText,
            conversationId,
            images: [generated],
          });
        }
        console.error(
          "[chat] Không sinh được ảnh, chuyển sang trả lời bằng văn bản."
        );
      }
    }

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      tools: TOOLS,
      toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
    });

    const contents = toGeminiContents(messages);
    const images: CollectedImage[] = [];
    let reply = "";

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
      const result = await model.generateContent({
        contents,
        systemInstruction: FULL_SYSTEM_INSTRUCTION,
      });
      const calls = result.response.functionCalls();

      if (!calls || calls.length === 0) {
        reply = result.response?.text() ?? "";
        break;
      }

      const modelParts = result.response.candidates?.[0]?.content.parts ?? [];
      const toolResponses = await Promise.all(
        calls.map(async (call) => {
          const toolResult = await runTool(
            call.name,
            (call.args ?? {}) as Record<string, unknown>,
            activePatientId,
            images
          );
          return {
            functionResponse: {
              name: call.name,
              response: { result: toolResult },
            },
          };
        })
      );

      contents.push({ role: "model", parts: modelParts });
      contents.push({ role: "user", parts: toolResponses });
    }

    if (!reply) {
      reply =
        "Xin lỗi, tôi chưa thể xử lý yêu cầu này lúc này. Bạn vui lòng thử lại sau nhé.";
    }

    if (lastMessage.role === "user") {
      await saveMessage(conversationId, {
        role: "assistant",
        content: reply,
      });
    }

    return NextResponse.json({
      response: reply,
      conversationId,
      images: images.length ? images : undefined,
    });
  } catch (error) {
    console.error("[chat] Lỗi xử lý tin nhắn chatbot:", error);
    return NextResponse.json(
      { error: "Không thể kết nối tới AI service." },
      { status: 500 }
    );
  }
}
