export type ChatRole = "user" | "assistant";

export interface GeneratedVideo {
  url: string;
  mimeType: string;
  prompt: string;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  videos?: GeneratedVideo[];
}

export interface ChatReply {
  reply: string;
  conversationId?: string;
  videos?: GeneratedVideo[];
}

export interface ChatPayload {
  conversationId?: string;
  messages: ChatMessage[];
}