import Image from "next/image";

import { cn } from "@/lib/utils";

export function LeagueLogo({
  alt,
  src,
  size = 56,
  className
}: {
  alt: string;
  src: string | null;
  size?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80",
          className
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image alt={alt} className="object-cover" fill sizes={`${size}px`} src={src} unoptimized />
    </div>
  );
}
