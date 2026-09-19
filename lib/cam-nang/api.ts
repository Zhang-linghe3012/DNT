import type { Post, PostSummary } from "./types";
import { readingMinutesFromHtml } from "./format";
import { supabase } from "@/lib/supabase/server";
import kbRaw from "@/data/dermatology-kb.json";

interface KbItem {
  source: string;
  title: string;
  content: string;
}

const kbData = kbRaw as KbItem[];

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

function slugify(value: string): string {
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

  return ascii.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "bai-viet";
}

function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, "<br />").trim())
    .filter(Boolean)
    .map((block) => `<p>${block}</p>`)
    .join("");
}

function excerptFromText(text: string, maxLength = 160): string {
  const plain = text.replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) {
    return plain;
  }
  return `${plain.slice(0, maxLength).trimEnd()}...`;
}

function buildLocalPostSummary(item: KbItem, index: number): PostSummary {
  const html = textToHtml(item.content);
  const date = new Date(Date.UTC(2026, 0, 1 + index));

  return {
    slug: slugify(item.title),
    title: item.title,
    excerpt: excerptFromText(item.content),
    publishedAt: date.toISOString().slice(0, 10),
    readingMinutes: readingMinutesFromHtml(html),
  };
}

function buildLocalPost(item: KbItem, index: number): Post {
  return {
    ...buildLocalPostSummary(item, index),
    content: textToHtml(item.content),
  };
}

const LOCAL_POSTS: PostSummary[] = kbData.map((item, index) =>
  buildLocalPostSummary(item, index)
);

const LOCAL_POSTS_BY_SLUG = new Map<string, Post>(
  kbData.map((item, index) => [slugify(item.title), buildLocalPost(item, index)])
);

export async function getPosts(): Promise<PostSummary[]> {
  try {
    const { data, error } = await supabase()
      .from("posts")
      .select(LIST_COLUMNS)
      .order("published_at", { ascending: false });

    if (error) {
      throw new CamNangApiError(`Lỗi khi đọc danh sách bài viết: ${error.message}`);
    }

    if (data && data.length > 0) {
      return (data as PostRow[]).map(mapPostSummary);
    }

    console.warn("[cam-nang] Supabase không có dữ liệu — dùng dữ liệu nội bộ.");
  } catch (error) {
    console.warn(
      "[cam-nang] Không đọc được bài viết từ Supabase, dùng dữ liệu nội bộ:",
      error
    );
  }

  return LOCAL_POSTS;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    const { data, error } = await supabase()
      .from("posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new CamNangApiError(`Lỗi khi đọc chi tiết bài viết: ${error.message}`);
    }

    if (data) {
      return mapPost(data as PostRow);
    }

    console.warn("[cam-nang] Không tìm thấy bài viết trong Supabase, thử dữ liệu nội bộ.");
  } catch (error) {
    console.warn(
      "[cam-nang] Không đọc được chi tiết bài viết từ Supabase, dùng dữ liệu nội bộ:",
      error
    );
  }

  return LOCAL_POSTS_BY_SLUG.get(slug) ?? null;
}