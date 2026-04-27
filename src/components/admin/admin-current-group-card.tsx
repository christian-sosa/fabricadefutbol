import Link from "next/link";

import { AdminSubnav } from "@/components/admin/admin-subnav";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { withOrgQuery } from "@/lib/org";

type AdminCurrentGroupCardProps = {
  organization: {
    name: string;
    slug: string;
  };
};

const secondaryActionLinkClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:bg-slate-800";

const groupActionLinkClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-emerald-400/45 bg-emerald-500/10 px-3.5 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/15";

export function AdminCurrentGroupCard({ organization }: AdminCurrentGroupCardProps) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Grupo actual
            </p>
            <CardTitle className="mt-2">{organization.name}</CardTitle>
            <CardDescription className="mt-2">
              Estas administrando este grupo. Los jugadores, partidos, rendimiento, imagen y
              facturacion se guardan aca.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className={secondaryActionLinkClass} href="/admin">
              Cambiar espacio
            </Link>
            <Link className={groupActionLinkClass} href={withOrgQuery("/admin/new", organization.slug)}>
              Nuevo grupo
            </Link>
          </div>
        </div>
      </Card>
      <AdminSubnav scope="organizations" />
    </div>
  );
}
