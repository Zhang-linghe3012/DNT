import PostSkeleton from "@/components/cam-nang/PostSkeleton";

export default function Loading() {
  return (
    <main className="container">
      <div className="skeleton skeleton--title" />
      <PostSkeleton />
    </main>
  );
}