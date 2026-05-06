import Link from "next/link";

import {
  createOrganizationAction,
  deleteOrganizationAction,
  uploadOrganizationImageAction
} from "@/app/admin/(panel)/actions";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { GroupActivityValueCard } from "@/components/admin/group-activity-value-card";
import { OrganizationImage } from "@/components/groups/organization-image";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import {
  getAdminOrganizationContext,
  getAdminOrganizationCreationAccess,
  getOrganizationWriteAccess
} from "@/lib/auth/admin";
import { getAdminClubs } from "@/lib/auth/clubs";
import { getLeagueCreationAccess } from "@/lib/auth/tournaments";
import { GROWTH_EVENTS } from "@/lib/growth";
import { getOrganizationImageUrl } from "@/lib/organization-images";
import { withOrgQuery } from "@/lib/org";
import { getAdminDashboardData } from "@/lib/queries/admin";
import { getOrganizationSeasons } from "@/lib/queries/public";
import { getAdminLeagueList } from "@/lib/queries/tournaments";

type OrganizationEntry = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  created_at: string;
};

type LeagueEntry = Awaited<ReturnType<typeof getAdminLeagueList>>[number];
type ClubEntry = Awaited<ReturnType<typeof getAdminClubs>>[number];
type OrganizationSeasonEntry = Awaited<ReturnType<typeof getOrganizationSeasons>>[number];

const leagueActionLinkClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-sky-400/45 bg-sky-500/10 px-3.5 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/15";

const clubActionLinkClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-indigo-400/45 bg-indigo-500/10 px-3.5 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/15";

const enterGroupLinkClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110";

const enterLeagueLinkClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-sky-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110";

const enterClubLinkClass =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-indigo-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110";

function findOrganizationByKey(organizations: OrganizationEntry[], organizationKey?: string | null) {
  if (!organizationKey) return null;
  const normalizedKey = organizationKey.trim().toLowerCase();
  if (!normalizedKey) return null;

  return (
    organizations.find(
      (organization) => organization.slug.toLowerCase() === normalizedKey || organization.id === organizationKey
    ) ?? null
  );
}

function formatDateOnlyEs(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

function getAnnualSeasonDisplayStart(season: OrganizationSeasonEntry) {
  const yearFromLabel = season.label.match(/\b(\d{4})\b/)?.[1];
  const yearFromEnd = season.endsAt.slice(0, 4);
  return `${yearFromLabel ?? yearFromEnd}-01-01`;
}

function formatOrganizationSeasonRange(season: OrganizationSeasonEntry) {
  return `${season.label}: ${formatDateOnlyEs(getAnnualSeasonDisplayStart(season))} a ${formatDateOnlyEs(season.endsAt)}`;
}

function AdminFeedback({
  checkout,
  error,
  success
}: {
  checkout?: string;
  error?: string;
  success?: string;
}) {
  if (!checkout && !error && !success) return null;

  return (
    <Card>
      {checkout ? (
        <p className="text-sm font-semibold text-emerald-300">
          Grupo actualizado.
        </p>
      ) : null}
      {success ? <p className="text-sm font-semibold text-emerald-300">{success}</p> : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
    </Card>
  );
}

function AdminOnboardingCard({
  canWrite,
  dashboardData,
  organizationSlug
}: {
  canWrite: boolean;
  dashboardData: Awaited<ReturnType<typeof getAdminDashboardData>>;
  organizationSlug: string;
}) {
  const totalMatches =
    dashboardData.draftsCount + dashboardData.confirmedCount + dashboardData.finishedCount;
  const steps = [
    {
      title: "Cargá jugadores",
      description: "Definí niveles y dejá listo el plantel base del grupo.",
      done: dashboardData.playersCount > 0,
      href: withOrgQuery("/admin/players", organizationSlug),
      cta: "Ir a jugadores"
    },
    {
      title: "Armá el primer partido",
      description: "Elegí modalidad, convocados, invitados y arqueros.",
      done: totalMatches > 0,
      href: withOrgQuery("/admin/matches", organizationSlug),
      cta: "Ir a partidos"
    },
    {
      title: "Cargá el resultado",
      description: "El ranking, el rendimiento y el historial quedan actualizados.",
      done: dashboardData.finishedCount > 0,
      href: withOrgQuery("/admin/matches", organizationSlug),
      cta: "Ver partidos"
    }
  ];

  if (steps.every((step) => step.done)) return null;

  return (
    <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 shadow-[0_20px_46px_-36px_rgba(16,185,129,0.8)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Primeros pasos
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">Dejá tu grupo listo para jugar</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Una guía rápida para pasar de grupo nuevo a primer partido con ranking e historial.
          </p>
        </div>
        {!canWrite ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
            Solo lectura
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <div
            className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
            key={step.title}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {index + 1}. {step.title}
              </p>
              <span
                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                  step.done
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {step.done ? "Listo" : "Pendiente"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{step.description}</p>
            <TrackedLink
              className="mt-4 inline-flex rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
              eventName={GROWTH_EVENTS.ctaClicked}
              eventProperties={{ cta: step.cta, source: "admin_onboarding" }}
              href={step.href}
            >
              {step.cta}
            </TrackedLink>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminHomeHub({
  creationAccess,
  clubs,
  checkout,
  error,
  leagueCreationAccess,
  leagues,
  organizations,
  showTournaments,
  success
}: {
  creationAccess: Awaited<ReturnType<typeof getAdminOrganizationCreationAccess>>;
  clubs: ClubEntry[];
  checkout?: string;
  error?: string;
  leagueCreationAccess: Awaited<ReturnType<typeof getLeagueCreationAccess>>;
  leagues: LeagueEntry[];
  organizations: OrganizationEntry[];
  showTournaments: boolean;
  success?: string;
}) {
  const hasOrganizations = organizations.length > 0;
  const hasClubs = clubs.length > 0;
  const hasLeagues = leagues.length > 0;
  const visibleHubCards = 1 + (hasClubs ? 1 : 0) + (showTournaments ? 1 : 0);
  const hubGridClass = visibleHubCards >= 3 ? "lg:grid-cols-2 xl:grid-cols-3" : visibleHubCards === 2 ? "lg:grid-cols-2" : "";

  return (
    <div className="space-y-4">
      <AdminFeedback checkout={checkout} error={error} success={success} />

      <Card className="p-5 sm:p-6">
        <CardTitle className="text-3xl">Que queres administrar?</CardTitle>
        <CardDescription className="mt-3 max-w-3xl text-base">
          {showTournaments || hasClubs
            ? "Elegi un espacio antes de cargar datos. Asi cada flujo mantiene jugadores, partidos, competencias y permisos en el lugar correcto."
            : "Elegi un grupo antes de cargar datos. Asi jugadores, partidos, rendimiento y configuracion quedan en el lugar correcto."}
        </CardDescription>
      </Card>

      <section className={`grid gap-4 ${hubGridClass}`}>
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Tus grupos</CardTitle>
              <CardDescription className="mt-2">
                Para partidos recurrentes, niveles de habilidad, rendimiento, historial y proximas fechas.
              </CardDescription>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {hasOrganizations ? (
              organizations.map((organization) => (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={organization.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{organization.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {organization.is_public ? "Publico" : "Privado"} - /{organization.slug}
                    </p>
                  </div>
                  <Link
                    className={enterGroupLinkClass}
                    href={withOrgQuery("/admin", organization.slug)}
                  >
                    Entrar al grupo
                  </Link>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <p className="text-sm font-semibold text-slate-100">Todavía no administrás grupos.</p>
                <p className="mt-1 text-sm text-slate-400">
                  Creá el primero para empezar a cargar jugadores y partidos semanales.
                </p>
                <form
                  action={createOrganizationAction}
                  className="mt-4 flex flex-col gap-3 md:flex-row"
                >
                  <Input name="name" placeholder="Nombre del grupo" required />
                  <Button disabled={!creationAccess.canCreateOrganization} type="submit">
                    Crear grupo
                  </Button>
                </form>
                {!creationAccess.canCreateOrganization ? (
                  <p className="mt-2 text-xs font-semibold text-amber-300">
                    {creationAccess.reason ??
                      "Si querés sumar otro grupo, escribinos y lo habilitamos manualmente."}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </Card>

        {hasClubs ? (
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Tus clubes</CardTitle>
                <CardDescription className="mt-2">
                  Para planteles, equipos del club, partidos 11 vs 11, torneos internos y estadisticas privadas.
                </CardDescription>
              </div>
              <Link
                className={clubActionLinkClass}
                href="/admin/clubs"
              >
                Ver clubes
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {clubs.map((club) => (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={club.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{club.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {club.status === "active" ? "Activo" : "Oculto"} - /clubs/{club.slug}
                    </p>
                  </div>
                  <Link
                    className={enterClubLinkClass}
                    href={`/admin/clubs/${club.id}`}
                  >
                    Entrar al club
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        {showTournaments ? (
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Tus ligas</CardTitle>
                <CardDescription className="mt-2">
                  Para torneos con equipos maestros, competencias, fixture, tabla y resultados publicos.
                </CardDescription>
              </div>
              {leagueCreationAccess.canCreateLeague ? (
                <Link
                  className={leagueActionLinkClass}
                  href="/admin/tournaments/new"
                >
                  Nueva liga
                </Link>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {hasLeagues ? (
                leagues.map((league) => (
                  <div
                    className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between"
                    key={league.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-slate-100">{league.name}</p>
                        <TournamentStatusBadge status={league.status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {league.teamCount} equipos - {league.competitionCount} competencias
                      </p>
                    </div>
                    <Link
                      className={enterLeagueLinkClass}
                      href={`/admin/tournaments/${league.id}`}
                    >
                      Entrar a la liga
                    </Link>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-sm font-semibold text-slate-100">Todavia no administras ligas.</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {leagueCreationAccess.canCreateLeague
                      ? "Crea una liga cuando necesites competencias, equipos inscriptos y tabla publica."
                      : (leagueCreationAccess.reason ?? "Por ahora las altas de ligas estan habilitadas manualmente.")}
                  </p>
                  {leagueCreationAccess.canCreateLeague ? (
                    <Link
                      className={`${enterLeagueLinkClass} mt-4`}
                      href="/admin/tournaments/new"
                    >
                      Crear liga
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; error?: string; checkout?: string; success?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const { admin, organizations } = await getAdminOrganizationContext(resolvedSearchParams.org);

  const creationAccess = await getAdminOrganizationCreationAccess(admin);
  const selectedOrganization = findOrganizationByKey(organizations, resolvedSearchParams.org);
  const showTournaments = admin.isSuperAdmin;
  const leagueCreationAccess = showTournaments
    ? await getLeagueCreationAccess(admin)
    : {
        canCreateLeague: false,
        reason: null
      };

  if (!selectedOrganization) {
    const [clubs, leagues] = await Promise.all([
      getAdminClubs(admin),
      showTournaments ? getAdminLeagueList() : Promise.resolve([])
    ]);

    return (
      <AdminHomeHub
        clubs={clubs}
        checkout={resolvedSearchParams.checkout}
        creationAccess={creationAccess}
        error={resolvedSearchParams.error}
        leagueCreationAccess={leagueCreationAccess}
        leagues={leagues}
        organizations={organizations}
        showTournaments={showTournaments}
        success={resolvedSearchParams.success}
      />
    );
  }

  const dashboardData = await getAdminDashboardData(selectedOrganization.id);
  const organizationWriteAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  const canWriteSelectedOrganization = organizationWriteAccess?.canWrite ?? false;
  const organizationSeasons = await getOrganizationSeasons(selectedOrganization.id);
  const activeSeason = organizationSeasons.find((season) => season.status === "active") ?? null;

  return (
    <div className="space-y-4">
      <AdminFeedback
        checkout={resolvedSearchParams.checkout}
        error={resolvedSearchParams.error}
        success={resolvedSearchParams.success}
      />

      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />

      <GroupActivityValueCard
        finishedCount={dashboardData.finishedCount}
        organizationSlug={selectedOrganization.slug}
        playersCount={dashboardData.playersCount}
        totalMatches={dashboardData.draftsCount + dashboardData.confirmedCount + dashboardData.finishedCount}
      />

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <CardTitle>Temporada del grupo</CardTitle>
            <CardDescription className="mt-2">
              Las temporadas son anuales y cierran el 31/12 a ultima hora. El ranking publico de temporada arranca en 1000; el acumulado historico se conserva para armar equipos.
            </CardDescription>
            <p className="mt-3 text-sm text-slate-300">
              {activeSeason
                ? formatOrganizationSeasonRange(activeSeason)
                : "Todavia no hay temporada activa. Se creara automaticamente al cargar un resultado."}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            Cierre fijo anual
          </span>
        </div>
      </Card>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <OrganizationImage
            alt={`Imagen de ${selectedOrganization.name}`}
            className="aspect-[16/9] min-h-[220px]"
            priority
            src={getOrganizationImageUrl(selectedOrganization.id)}
          />

          <div>
            <CardTitle>Imagen del grupo</CardTitle>
            <CardDescription className="mt-2">
              Sube una foto que represente al grupo o una imagen post partido. Se mostrara en la vista publica de grupos.
            </CardDescription>

            <form action={uploadOrganizationImageAction} className="mt-4 space-y-3">
              <input name="organizationId" type="hidden" value={selectedOrganization.id} />
              <Input accept="image/png,image/jpeg,image/webp" name="image" type="file" />
              <Button disabled={!canWriteSelectedOrganization} type="submit">
                Guardar imagen
              </Button>
            </form>
          </div>
        </div>
      </Card>

      {admin.isSuperAdmin ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardTitle className="text-danger">Zona super admin</CardTitle>
          <CardDescription className="mt-1 text-slate-200">
            Esta accion elimina el grupo seleccionado y todos sus datos asociados, incluyendo fotos,
            jugadores, partidos, historial, admins e invitaciones.
          </CardDescription>
          <form action={deleteOrganizationAction} className="mt-4">
            <input name="organizationId" type="hidden" value={selectedOrganization.id} />
            <ConfirmSubmitButton
              confirmMessage={`Estas seguro de borrar ${selectedOrganization.name}? Se perderan definitivamente todas las fotos, jugadores, partidos, historial, admins, invitaciones y datos asociados. Esta accion no se puede deshacer.`}
              label="Borrar grupo"
              variant="danger"
            />
          </form>
        </Card>
      ) : null}

      <AdminOnboardingCard
        canWrite={canWriteSelectedOrganization}
        dashboardData={dashboardData}
        organizationSlug={selectedOrganization.slug}
      />
    </div>
  );
}
