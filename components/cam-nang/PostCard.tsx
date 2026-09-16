"use client";

import Link from "next/link";
import type { PostSummary } from "@/lib/cam-nang/types";
import { formatDate, formatReadingTime } from "@/lib/cam-nang/format";
import PostThumb from "./PostThumb";

export default function PostCard({ post }: { post: PostSummary }) {
  return (
    <Link href={`/cam-nang/${post.slug}`} className="post-card">
      {post.image ? (
        <PostThumb
          src={post.image}
          alt={post.title}
          className="post-card__thumb"
        />
      ) : (
        <div className="post-card__thumb" />
      )}
      <div className="post-card__body">
        <div className="post-card__badges">
          {post.category && <span className="badge">{post.category}</span>}
          <span className="badge badge--ghost">
            {formatReadingTime(post.readingMinutes)}
          </span>
        </div>
        <h3 className="post-card__title">{post.title}</h3>
        <p className="post-card__meta">{formatDate(post.publishedAt)}</p>
      </div>
    </Link>
  );
}