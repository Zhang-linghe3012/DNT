import type { Post, PostSummary } from "./types";
import { readingMinutesFromHtml } from "./format";
import { supabase } from "@/lib/supabase/server";

class CamNangApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CamNangApiError";
  }
}

interface PostRow {
  slug: string;
  title: string;
  excerpt: string | null;
  image: string | null;
  category: string | null;
  published_at: string | null;
  content: string | null;
  author: string | null;
}

const LIST_COLUMNS =
  "slug, title, excerpt, image, category, published_at, content";

function mapPostSummary(row: PostRow): PostSummary {
  return {
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    image: row.image ?? undefined,
    category: row.category ?? undefined,
    publishedAt: row.published_at ?? new Date().toISOString(),
    readingMinutes: readingMinutesFromHtml(row.content ?? ""),
  };
}

function mapPost(row: PostRow): Post {
  return {
    ...mapPostSummary(row),
    content: row.content ?? "",
    author: row.author ?? undefined,
  };
}

export async function getPosts(): Promise<PostSummary[]> {
  const { data, error } = await supabase()
    .from("posts")
    .select(LIST_COLUMNS)
    .order("published_at", { ascending: false });

  if (error) {
    throw new CamNangApiError(`Lỗi khi đọc danh sách bài viết: ${error.message}`);
  }

  return (data ?? []).map((row) => mapPostSummary(row as PostRow));
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const { data, error } = await supabase()
    .from("posts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new CamNangApiError(`Lỗi khi đọc chi tiết bài viết: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapPost(data as PostRow);
}