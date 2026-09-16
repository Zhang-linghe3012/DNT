import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cẩm nang & Chatbot AI tư vấn",
    template: "%s | Cẩm nang & Chatbot",
  },
  description: "Dự án dự bị: module Cẩm nang bài viết và Chatbot AI tư vấn.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <header className="site-header">
          <nav>
            <Link href="/">Trang chủ</Link>
            <Link href="/cam-nang">Cẩm nang</Link>
            <Link href="/chatbot">Chatbot AI</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}