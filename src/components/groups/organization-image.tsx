import Image from "next/image";

import { cn } from "@/lib/utils";

export function OrganizationImage({
  alt,
  src,
  className,
  priority = false
}: {
  alt: string;
  src: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-900/85",
        className
      )}
    >
      <Image alt={alt} className="object-cover" fill priority={priority} sizes="(max-width: 1024px) 100vw, 60vw" src={src} unoptimized />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-transparent" />
    </div>
  );
}
