import Link from "next/link";

export default function CamNangNotFound() {
  return (
    <main className="container">
      <h1 className="page-title">Không tìm thấy bài viết</h1>
      <p className="page-description">
        Bài viết bạn đang tìm không tồn tại hoặc đã bị xoá.
      </p>
      <Link href="/cam-nang">Quay lại danh sách cẩm nang</Link>
    </main>
  );
}