import type { Metadata } from "next";
import ChatBox from "@/components/chatbot/ChatBox";

export const metadata: Metadata = {
  title: "Chatbot AI tư vấn",
};

export default function ChatbotPage() {
  return (
    <main className="container">
      <h1 className="page-title">Chatbot AI tư vấn</h1>
      <p className="page-description">
        Đặt câu hỏi, AI sẽ tư vấn cho bạn dựa trên nội dung của website.
      </p>
      <ChatBox />
    </main>
  );
}