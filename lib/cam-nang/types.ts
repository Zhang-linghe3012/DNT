export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  image?: string;
  category?: string;
  publishedAt: string;
  readingMinutes: number;
}

export interface Post extends PostSummary {
  content: string;
  author?: string;
}