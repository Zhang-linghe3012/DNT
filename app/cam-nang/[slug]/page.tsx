import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostBySlug } from "@/lib/cam-nang/api";
import { formatDate } from "@/lib/cam-nang/format";
import PostContent from "@/components/cam-nang/PostContent";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  return {
    title: post?.title ?? "Không tìm thấy bài viết",
    description: post?.excerpt,
  };
}

export default async function CamNangDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <main className="container">
      <article className="post-detail">
        {post.image && (
          <img
            src={post.image}
            alt={post.title}
            className="post-detail__cover"
          />
        )}
        <h1>{post.title}</h1>
        <p className="post-detail__meta">
          {post.category && <span className="badge">{post.category}</span>}{" "}
          {formatDate(post.publishedAt)}
          {post.author ? ` · ${post.author}` : ""}
        </p>
        <PostContent content={post.content} />
      </article>
    </main>
  );
}