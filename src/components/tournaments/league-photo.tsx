import Image from "next/image";

import { cn } from "@/lib/utils";

export function LeaguePhoto({
  alt,
  src,
  className,
  priority = false
}: {
  alt: string;
  src: string | null;
  className?: string;
  priority?: boolean;
}) {
  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-[1.75rem] border border-dashed border-slate-800 bg-slate-950/70 px-6 py-10 text-center text-sm text-slate-500",
          className
        )}
      >
        Todavia no cargaste una foto para esta liga.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-slate-800 bg-slate-900/85",
        className
      )}
    >
      <Image alt={alt} className="object-cover" fill priority={priority} sizes="(max-width: 1024px) 100vw, 40vw" src={src} unoptimized />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
    </div>
  );
}
