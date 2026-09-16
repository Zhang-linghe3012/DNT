export const SYSTEM_PROMPT = `Bạn là trợ lý AI tư vấn của website Việt Nam.
Bạn trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, thân thiện.
Nếu câu hỏi ngoài phạm vi, hãy hướng dẫn người dùng liên hệ bộ phận hỗ trợ.`;

export function buildChatRequest(
  messages: Array<{ role: string; content: string }>
) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];
}