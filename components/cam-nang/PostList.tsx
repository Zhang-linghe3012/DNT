"use client";

import { useMemo, useState } from "react";
import type { PostSummary } from "@/lib/cam-nang/types";
import PostCard from "./PostCard";
import FeaturedPostCard from "./FeaturedPostCard";

const ALL_CATEGORIES = "Tất cả";

export default function PostList({ posts }: { posts: PostSummary[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          posts
            .map((post) => post.category)
            .filter((item): item is string => Boolean(item))
        )
      ),
    [posts]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return posts.filter((post) => {
      const matchCategory =
        category === ALL_CATEGORIES || post.category === category;
      const matchSearch =
        !query || post.title.toLowerCase().includes(query);

      return matchCategory && matchSearch;
    });
  }, [posts, search, category]);

  const [featured, ...rest] = filtered;

  return (
    <>
      <div className="cam-nang-toolbar">
        <input
          type="search"
          className="cam-nang-search"
          placeholder="Tìm kiếm theo tiêu đề..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="cam-nang-filter"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value={ALL_CATEGORIES}>{ALL_CATEGORIES}</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {featured ? (
        <>
          <FeaturedPostCard post={featured} />
          {rest.length > 0 && (
            <div className="post-grid">
              {rest.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="empty-state">Không tìm thấy bài viết phù hợp.</p>
      )}
    </>
  );
}