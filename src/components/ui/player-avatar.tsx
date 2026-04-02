import Image from "next/image";

import { cn } from "@/lib/utils";

type PlayerAvatarProps = {
  playerId?: string;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses: Record<NonNullable<PlayerAvatarProps["size"]>, string> = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-14 w-14"
};

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "??";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function getPlayerPhotoSrc(playerId?: string) {
  if (!playerId) return "/avatar-placeholder.svg";
  return `/api/player-photo/${encodeURIComponent(playerId)}`;
}

export function PlayerAvatar({ playerId, name, size = "md", className }: PlayerAvatarProps) {
  const src = getPlayerPhotoSrc(playerId);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-full border border-slate-700 bg-slate-800 ring-1 ring-slate-700/60",
        sizeClasses[size],
        className
      )}
    >
      <Image alt={`Avatar de ${name}`} className="object-cover" fill sizes="56px" src={src} />
      {!playerId ? (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tracking-wide text-slate-100">
          {getInitials(name)}
        </span>
      ) : null}
    </div>
  );
}
