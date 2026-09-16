export default function PostSkeleton() {
  return (
    <>
      <div className="cam-nang-toolbar">
        <div className="skeleton skeleton--search" />
        <div className="skeleton skeleton--filter" />
      </div>
      <div className="skeleton skeleton--featured" />
      <div className="post-grid">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton skeleton--card" />
        ))}
      </div>
    </>
  );
}