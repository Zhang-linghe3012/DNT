export default function PostContent({ content }: { content: string }) {
  return <div className="post-content" dangerouslySetInnerHTML={{ __html: content }} />;
}