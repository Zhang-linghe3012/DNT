"use client";

import type { SyntheticEvent } from "react";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop";

const FALLBACK_ATTR = "data-fallback-image";

interface PostThumbProps {
  src: string;
  alt: string;
  className?: string;
}

function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;

  if (img.hasAttribute(FALLBACK_ATTR)) {
    return;
  }

  img.src = FALLBACK_IMAGE;
  img.setAttribute(FALLBACK_ATTR, "true");
}

export default function PostThumb({ src, alt, className }: PostThumbProps) {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={handleImageError}
    />
  );
}