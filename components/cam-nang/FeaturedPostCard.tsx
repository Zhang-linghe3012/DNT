"use client";

import Link from "next/link";
import type { PostSummary } from "@/lib/cam-nang/types";
import { formatDate, formatReadingTime } from "@/lib/cam-nang/format";
import PostThumb from "./PostThumb";

export default function FeaturedPostCard({ post }: { post: PostSummary }) {
  return (
    <Link href={`/cam-nang/${post.slug}`} className="featured-post">
      {post.image ? (
        <PostThumb
          src={post.image}
          alt={post.title}
          className="featured-post__image"
        />
      ) : (
        <div className="featured-post__image" />
      )}
      <div className="featured-post__body">
        {post.category && <span className="badge">{post.category}</span>}
        <h2 className="featured-post__title">{post.title}</h2>
        <p className="featured-post__excerpt">{post.excerpt}</p>
        <p className="post-card__meta">
          {formatDate(post.publishedAt)} ·{" "}
          {formatReadingTime(post.readingMinutes)}
        </p>
      </div>
    </Link>
  );
}