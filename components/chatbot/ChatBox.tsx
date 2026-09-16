"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { sendChatMessage } from "@/lib/chatbot/api";
import type { ChatMessage } from "@/lib/chatbot/types";

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content: "Xin chào! Mình là trợ lý AI. Bạn cần mình tư vấn gì?",
};

export default function ChatBox({ title = "AI Tư vấn" }: { title?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || loading) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content: text };
    const history = messages.filter((m) => m.role === "user");
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { reply, conversationId: nextId, videos } = await sendChatMessage(
        [...history, userMessage],
        conversationId ?? undefined
      );
      if (nextId) {
        setConversationId(nextId);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, videos },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Rất tiếc, chatbot đang gặp sự cố. Vui lòng thử lại sau.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([WELCOME_MESSAGE]);
    setConversationId(null);
    setInput("");
  }

  return (
    <div className="chat-box">
      <div className="chat-box__header">
        <span>{title}</span>
        <button type="button" className="chat-box__clear" onClick={handleClear}>
          Làm mới
        </button>
      </div>

      <div className="chat-box__history" suppressHydrationWarning>
        {isMounted &&
          messages.map((message, index) => (
            <div
              key={index}
              className={`chat-msg chat-msg--${message.role}`}
            >
              {message.role === "assistant" ? (
                <>
                  <div className="markdown">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                  {message.videos?.length ? (
                    <div className="chat-msg__media">
                      {message.videos.map((video, vIndex) => (
                        <video
                          key={vIndex}
                          className="chat-msg__video"
                          src={video.url}
                          controls
                          muted
                          playsInline
                          preload="metadata"
                        >
                          Trình duyệt của bạn không hỗ trợ phát video.
                        </video>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                message.content
              )}
            </div>
          ))}
        {isMounted && loading && <div className="chat-typing">AI đang trả lời...</div>}
        <div ref={historyEndRef} />
      </div>

      <form className="chat-box__form" onSubmit={handleSend}>
        <input
          className="chat-box__input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Nhập câu hỏi của bạn..."
          autoComplete="off"
        />
        <button
          type="submit"
          className="chat-box__send"
          disabled={loading || !input.trim()}
        >
          Gửi
        </button>
      </form>
    </div>
  );
}