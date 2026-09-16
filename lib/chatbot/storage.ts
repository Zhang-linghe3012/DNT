import type { ChatMessage } from "./types";
import { supabase } from "@/lib/supabase/server";

export async function findOrCreateConversation(
  conversationId?: string
): Promise<string> {
  const db = supabase();

  if (conversationId) {
    const { data, error } = await db
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (data) {
      return data.id;
    }
  }

  const { data, error } = await db
    .from("conversations")
    .insert({})
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
}

export async function saveMessage(
  conversationId: string,
  message: ChatMessage
): Promise<void> {
  const { error } = await supabase().from("messages").insert({
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
  });

  if (error) {
    throw new Error(error.message);
  }
}