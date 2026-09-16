import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <h1 className="page-title">Cẩm nang &amp; Chatbot AI tư vấn</h1>
      <p className="page-description">
        Dự án chứa 2 module được phát triển độc lập, sẵn sàng để gộp vào repo
        chung của nhóm.
      </p>
      <div className="home-grid">
        <Link href="/cam-nang" className="feature-card">
          <h2>Cẩm nang bài viết</h2>
          <p>Danh sách và chi tiết bài viết, đọc dữ liệu từ API trung tâm.</p>
        </Link>
        <Link href="/chatbot" className="feature-card">
          <h2>Chatbot AI tư vấn</h2>
          <p>Hội thoại với AI qua API tương thích OpenAI, nhúng được ở mọi nơi.</p>
        </Link>
      </div>
    </main>
  );
}