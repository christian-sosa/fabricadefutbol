import Link from "next/link";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import {
  deleteOrganizationAction,
  archiveOrganizationAction,
  restoreOrganizationAction
} from "@/app/admin/(panel)/actions";
import { createOrganizationFormAction, uploadOrganizationImageFormAction } from "@/app/admin/(panel)/form-actions";
import { OrganizationImageInput } from "@/components/admin/organization-image-input";
import { ActionForm } from "@/components/ui/action-form";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { TrackedLink } from "@/components/analytics/tracked-link";
import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { AdminGroupDirectory } from "@/components/admin/admin-group-directory";
import { AdminMatchOverview } from "@/components/admin/admin-match-overview";
import { GroupActivityValueCard } from "@/components/admin/group-activity-value-card";
import { OrganizationImage } from "@/components/groups/organization-image";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import {
  getAdminOrganizationContext,
  getAdminOrganizationCreationAccess,
  getArchivedAdminOrganizations,
  getOrganizationWriteAccess
} from "@/lib/auth/admin";
import { MATCH_MODALITIES, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { GROWTH_EVENTS } from "@/lib/growth";
import { getOrganizationImageUrl } from "@/lib/organization-images";
import { withOrgQuery } from "@/lib/org";
import { getAdminDashboardData } from "@/lib/queries/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationSeasons } from "@/lib/queries/public";

type OrganizationEntry = {
  id: string;
  name: string;
  slug: string;
  is_public: boolean;
  created_at: string;
};

type OrganizationSeasonEntry = Awaited<ReturnType<typeof getOrganizationSeasons>>[number];

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

function formatOrganizationSeasonDates(season: OrganizationSeasonEntry) {
  return `${formatDateOnlyEs(getAnnualSeasonDisplayStart(season))} a ${formatDateOnlyEs(season.endsAt)}`;
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
      {success ? <p className="text-sm font-semibold text-emerald-300" role="status">{success}</p> : null}
      {error ? <p className="text-sm font-semibold text-danger" role="alert">{error}</p> : null}
    </Card>
  );
}

function ArchivedGroups({ organizations }: { organizations: Array<OrganizationEntry & { archived_at: string }> }) {
  if (!organizations.length) return null;
  return <Card>
    <CardTitle>Grupos archivados</CardTitle>
    <CardDescription className="mt-2">Conservan jugadores, fotos e historial. Restaurá un grupo para volver a usarlo y mostrarlo públicamente según su configuración.</CardDescription>
    <div className="mt-4 space-y-4">{organizations.map((organization) => <div className="rounded-xl border border-slate-700 p-4" key={organization.id}>
      <p className="font-semibold">{organization.name}</p>
      <form action={restoreOrganizationAction} className="mt-3">
        <input name="organizationId" type="hidden" value={organization.id} />
        <FormSubmitButton pendingLabel="Restaurando…" variant="secondary">Restaurar {organization.name}</FormSubmitButton>
      </form>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-slate-400">Eliminación definitiva</summary>
        <p className="mb-3 text-sm text-slate-300">Borra todos los datos y fotos de este grupo. Requiere verificar tu cuenta desde <Link className="underline" href="/admin/security">Seguridad</Link> y no se puede deshacer.</p>
        <form action={deleteOrganizationAction}>
          <input name="organizationId" type="hidden" value={organization.id} />
          <ConfirmSubmitButton confirmMessage={`¿Eliminar definitivamente ${organization.name}, sus jugadores, fotos, partidos e historial? Esta acción no se puede deshacer.`} label={`Eliminar definitivamente ${organization.name}`} variant="danger" />
        </form>
      </details>
    </div>)}</div>
  </Card>;
}

function AdminOnboardingCard({
  canWrite,
  dashboardData,
  organizationSlug,
  modality
}: {
  canWrite: boolean;
  dashboardData: Awaited<ReturnType<typeof getAdminDashboardData>>;
  organizationSlug: string;
  modality?: string;
}) {
  const selectedModality = MATCH_MODALITIES.find((value) => value === modality) ?? "6v6";
  const requiredPlayers = TEAM_SIZE_BY_MODALITY[selectedModality] * 2;
  const totalMatches =
    dashboardData.draftsCount + dashboardData.confirmedCount + dashboardData.finishedCount;
  const draftMatch = dashboardData.latestMatches.find((match) => match.status === "draft");
  const confirmedMatch = dashboardData.latestMatches.find((match) => match.status === "confirmed");
  const steps = [
    {
      title: "Cargá jugadores",
      description: `${dashboardData.playersCount} de ${requiredPlayers} jugadores para ${selectedModality}. Podés ajustar los niveles después.`,
      done: dashboardData.playersCount >= requiredPlayers || totalMatches > 0,
      href: withOrgQuery("/admin/players?view=new", organizationSlug),
      cta: "Ir a jugadores"
    },
    {
      title: draftMatch ? "Confirmá los equipos" : "Armá el primer partido",
      description: draftMatch ? "Tu borrador está listo. Compará las opciones y elegí los equipos que van a jugar." : "Elegí modalidad, convocados, invitados y arqueros. Después confirmá una opción de equipos.",
      done: dashboardData.confirmedCount + dashboardData.finishedCount > 0,
      href: withOrgQuery(draftMatch ? `/admin/matches/${draftMatch.id}` : dashboardData.draftsCount ? "/admin/matches" : `/admin/matches/new?modality=${selectedModality}`, organizationSlug),
      cta: "Armar partido"
    },
    {
      title: "Compartí y cargá el resultado",
      description: "Compartí los equipos por WhatsApp. Después del partido, cargá el resultado para actualizar ranking e historial.",
      done: dashboardData.finishedCount > 0,
      href: withOrgQuery(confirmedMatch ? `/admin/matches/${confirmedMatch.id}` : "/admin/matches", organizationSlug),
      cta: "Ver partidos"
    }
  ];

  const nextStep = steps.find((step) => !step.done);
  if (!nextStep) return null;

  return (
    <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 shadow-[0_20px_46px_-36px_rgba(16,185,129,0.8)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Tu próximo paso
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">{nextStep.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            {nextStep.description}
          </p>
        </div>
        {!canWrite ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
            Solo lectura
          </span>
        ) : null}
      </div>

      {canWrite ? <TrackedLink
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
        eventName={GROWTH_EVENTS.ctaClicked}
        eventProperties={{ cta: nextStep.cta, source: "admin_onboarding" }}
        href={nextStep.href}
      >Continuar: {nextStep.title.toLocaleLowerCase("es")}</TrackedLink> : null}

      <form className="mt-4 flex flex-wrap items-center gap-2" action="/admin">
        <input name="org" type="hidden" value={organizationSlug} />
        <label className="text-sm" htmlFor="onboarding-modality">¿Cuántos juegan?</label>
        <select className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm" defaultValue={selectedModality} id="onboarding-modality" name="modality">
          {MATCH_MODALITIES.map((value) => <option key={value} value={value}>{value.replace("v", " vs ")}</option>)}
        </select><Button type="submit" variant="secondary">Actualizar pasos</Button>
      </form>
      <ol aria-label="Progreso del primer partido" className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            aria-current={step === nextStep ? "step" : undefined}
            className="border-t border-slate-700 pt-3"
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
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function AdminDashboardPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; view?: string; error?: string; checkout?: string; success?: string; modality?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const showGroupsDirectory = resolvedSearchParams.view === "groups";
  const { admin, organizations } = await getAdminOrganizationContext(resolvedSearchParams.org);

  const [creationAccess, archivedOrganizations] = await Promise.all([
    getAdminOrganizationCreationAccess(admin),
    getArchivedAdminOrganizations(admin)
  ]);
  if (!showGroupsDirectory && !resolvedSearchParams.org && organizations.length === 1 && !archivedOrganizations.length) {
    redirect(withOrgQuery("/admin", organizations[0].slug));
  }
  const selectedOrganization = resolvedSearchParams.org
    ? findOrganizationByKey(organizations, resolvedSearchParams.org)
    : !showGroupsDirectory && organizations.length === 1 ? organizations[0] : null;
  if (showGroupsDirectory || !selectedOrganization) {
    const newOrganizationId = randomUUID();
    return <div className="space-y-4">
      <AdminFeedback error={resolvedSearchParams.error} success={resolvedSearchParams.success} />
      <Card className="rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Tu espacio de trabajo</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{organizations.length ? "Tus grupos" : "Creá tu primer grupo"}</h1>
            <CardDescription className="mt-2 max-w-2xl">{organizations.length ? "Elegí el grupo que querés administrar. Cada uno tiene sus jugadores, partidos e historial." : "Empezá por el nombre. Después podés pegar la lista de jugadores y armar el primer partido."}</CardDescription>
          </div>
          {organizations.length && creationAccess.canCreateOrganization ? <Link className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200" href="/admin/new">+ Nuevo grupo</Link> : null}
        </div>
        {organizations.length ? <div className="mt-6"><AdminGroupDirectory organizations={organizations} /></div> :
          <ActionForm action={createOrganizationFormAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input name="organizationId" type="hidden" value={newOrganizationId} />
            <Input aria-label="Nombre del grupo" name="name" placeholder="Nombre del grupo" required />
            <FormSubmitButton disabled={!creationAccess.canCreateOrganization} pendingLabel="Creando grupo…">Crear grupo gratis</FormSubmitButton>
          </ActionForm>}
        {!creationAccess.canCreateOrganization ? <Link className="mt-4 block text-sm text-emerald-300 underline" href="/feedback?intent=multiple_groups">Necesito administrar otro grupo</Link> : null}
      </Card>
      <ArchivedGroups organizations={archivedOrganizations} />
    </div>;
  }

  const dashboardData = await getAdminDashboardData(selectedOrganization.id);
  const organizationWriteAccess = await getOrganizationWriteAccess(admin, selectedOrganization.id);
  const canWriteSelectedOrganization = organizationWriteAccess?.canWrite ?? false;
  const supabase = await createSupabaseServerClient();
  const { error: seasonError } = await supabase.rpc("ensure_group_current_season", { p_organization_id: selectedOrganization.id });
  if (seasonError) throw new Error("No se pudo preparar la temporada actual.");
  const organizationSeasons = await getOrganizationSeasons(selectedOrganization.id);
  const activeSeason = organizationSeasons.find((season) => season.status === "active") ?? null;
  const organizationImageSrc = getOrganizationImageUrl(selectedOrganization.id);

  return (
    <div className="space-y-4">
      <AdminFeedback
        checkout={resolvedSearchParams.checkout}
        error={resolvedSearchParams.error}
        success={resolvedSearchParams.success}
      />

      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} titleAs="h1" />

      <AdminOnboardingCard
        canWrite={canWriteSelectedOrganization}
        dashboardData={dashboardData}
        organizationSlug={selectedOrganization.slug}
        modality={resolvedSearchParams.modality ?? dashboardData.latestMatches[0]?.modality}
      />

      <AdminMatchOverview
        canWrite={canWriteSelectedOrganization}
        matches={dashboardData.latestMatches}
        organizationSlug={selectedOrganization.slug}
      />

      <GroupActivityValueCard
        finishedCount={dashboardData.finishedCount}
        playersCount={dashboardData.playersCount}
        seasonLabel={activeSeason?.label}
        seasonRange={activeSeason ? formatOrganizationSeasonDates(activeSeason) : undefined}
        totalMatches={dashboardData.draftsCount + dashboardData.confirmedCount + dashboardData.finishedCount}
      />

      <details className="rounded-2xl border border-slate-800 p-4">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">Personalizar foto de portada</summary>
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <OrganizationImage
            alt={`Imagen de ${selectedOrganization.name}`}
            className="aspect-[16/9] min-h-[220px]"
            priority
            src={organizationImageSrc}
          />

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Identidad publica
              </p>
              <CardTitle className="mt-2">Foto de portada</CardTitle>
            </div>
            <CardDescription className="mt-2">
              Usa una foto que represente al grupo o una imagen post partido. Se muestra en la vista publica de grupos.
            </CardDescription>

            <details>
              <summary className="mt-4 flex w-fit cursor-pointer list-none items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300">
                Cambiar imagen
              </summary>
              <ActionForm action={uploadOrganizationImageFormAction} className="mt-4 space-y-3">
                <input name="organizationId" type="hidden" value={selectedOrganization.id} />
                <OrganizationImageInput />
                <FormSubmitButton disabled={!canWriteSelectedOrganization} pendingLabel="Guardando portada…">
                  Guardar imagen
                </FormSubmitButton>
              </ActionForm>
            </details>
          </div>
        </div>
      </details>

      {admin.isSuperAdmin ? (
        <details className="rounded-2xl border border-slate-800 p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-slate-400">Administración avanzada</summary>
          <CardTitle className="mt-4">Archivar grupo</CardTitle>
          <CardDescription className="mt-1">
            Ocultá el grupo y pausá su administración conservando jugadores, fotos e historial. Podés restaurarlo desde los grupos archivados.
          </CardDescription>
          <form action={archiveOrganizationAction} className="mt-4">
            <input name="organizationId" type="hidden" value={selectedOrganization.id} />
            <ConfirmSubmitButton
              confirmMessage={`¿Archivar ${selectedOrganization.name}? Se ocultará y dejará de poder editarse hasta restaurarlo. Sus datos se conservan.`}
              label="Archivar grupo"
              variant="secondary"
            />
          </form>
        </details>
      ) : null}
      <ArchivedGroups organizations={archivedOrganizations} />
    </div>
  );
}
