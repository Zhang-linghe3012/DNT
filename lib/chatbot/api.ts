import type { ChatMessage, ChatReply } from "./types";

export async function sendChatMessage(
  messages: ChatMessage[],
  conversationId?: string
): Promise<ChatReply> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, conversationId }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error ?? "Không thể kết nối tới chatbot.");
  }

  return {
    reply: data?.response ?? data?.reply ?? "",
    conversationId: data?.conversationId,
    videos: data?.videos ?? undefined,
  } as ChatReply;
}