import type { Metadata } from "next";
import { getPosts } from "@/lib/cam-nang/api";
import PostList from "@/components/cam-nang/PostList";

export const metadata: Metadata = {
  title: "Cẩm nang bài viết",
};

export const dynamic = "force-dynamic";

export default async function CamNangListPage() {
  const posts = await getPosts();

  return (
    <main className="container">
      <h1 className="page-title">Cẩm nang bài viết</h1>
      <p className="page-description">Tổng hợp các bài viết hữu ích.</p>
      <PostList posts={posts} />
    </main>
  );
}