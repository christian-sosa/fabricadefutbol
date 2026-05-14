import Link from "next/link";
import Image from "next/image";

import { adminContextActionLinkClass } from "@/components/admin/admin-context-actions";
import { AdminSubnav } from "@/components/admin/admin-subnav";
import { SignOutButton } from "@/components/admin/sign-out-button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { AdminSession } from "@/lib/auth/admin";
import { getOrganizationImageUrl } from "@/lib/organization-images";

type AdminCurrentGroupCardProps = {
  admin: AdminSession;
  organization: {
    id?: string;
    imageSrc?: string;
    name: string;
    slug: string;
  };
};

export function AdminCurrentGroupCard({ admin, organization }: AdminCurrentGroupCardProps) {
  const groupImageSrc =
    organization.imageSrc ?? (organization.id ? getOrganizationImageUrl(organization.id) : null);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                Modo administrador / {admin.displayName}
              </p>
              <p className="text-sm text-slate-400">{admin.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">
                Grupo actual
              </p>
              <div className="mt-2 flex items-center gap-3">
                {groupImageSrc ? (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border border-emerald-400/25 bg-slate-950">
                    <Image
                      alt={`Escudo de ${organization.name}`}
                      className="object-cover"
                      fill
                      sizes="56px"
                      src={groupImageSrc}
                      unoptimized
                    />
                  </div>
                ) : null}
                <CardTitle>{organization.name}</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Estas administrando este grupo. Los jugadores, partidos, rendimiento, imagen y
                configuracion se guardan aca.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {admin.isSuperAdmin ? (
              <Link className={adminContextActionLinkClass} href="/admin/super">
                Super Admin
              </Link>
            ) : null}
            <Link className={adminContextActionLinkClass} href="/admin">
              Cambiar espacio
            </Link>
            <SignOutButton />
          </div>
        </div>
      </Card>
      <AdminSubnav scope="organizations" />
    </div>
  );
}
