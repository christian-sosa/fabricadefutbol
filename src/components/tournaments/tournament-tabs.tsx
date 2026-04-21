import Link from "next/link";

import { cn } from "@/lib/utils";

type TournamentTabItem = {
  href: string;
  label: string;
  active: boolean;
};

export function TournamentTabs({ items }: { items: TournamentTabItem[] }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition md:text-sm",
            item.active
              ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
              : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800"
          )}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
