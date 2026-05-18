import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addClubCallupAction,
  addClubCallupGuestAction,
  addClubCompetitionAction,
  addClubMatchAction,
  addClubPlayerAction,
  addClubProductAction,
  addClubTeamAction,
  addClubTeamPlayersAction,
  bulkAddClubPlayersAction,
  deleteClubProductAction,
  inviteClubAdminAction,
  removeClubTeamPlayerAction,
  removeClubAdminAction,
  revokeClubAdminInviteAction,
  toggleClubCompetitionAction,
  toggleClubPlayerAction,
  updateClubAction,
  updateClubCallupPlayerAction,
  updateClubMatchFinanceAction,
  updateClubProductAction,
  updateClubSiteSettingsAction,
  updateClubTeamAction,
  uploadClubProductImageAction,
  uploadClubSiteHeroAction,
  uploadClubLogoAction,
  uploadClubPlayerPhotoAction
} from "@/app/admin/(panel)/clubs/[clubId]/actions";
import {
  adminContextActionLinkClass,
  adminContextPrimaryActionLinkClass
} from "@/components/admin/admin-context-actions";
import { OptimizedClubSiteImageInput } from "@/components/admin/optimized-club-site-image-input";
import { MatchGuestFields } from "@/app/admin/(panel)/clubs/[clubId]/match-guest-fields";
import { MatchPlayerPicker } from "@/app/admin/(panel)/clubs/[clubId]/match-player-picker";
import { MatchDateTimeFields } from "@/components/admin/match-date-time-fields";
import { LeagueLogo } from "@/components/tournaments/league-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { requireAdminClub } from "@/lib/auth/clubs";
import { formatMatchModality, MATCH_MODALITIES } from "@/lib/constants";
import { getCurrentMatchDateInput } from "@/lib/match-datetime";
import {
  CLUB_PLAYER_POSITIONS,
  buildClubCallupSummary,
  buildClubTeamRosterOptions,
  filterClubPlayersForRosterManagement,
  formatClubPlayerPosition,
  getClubPaymentStatus,
  normalizeClubPlayerPosition,
  type ClubCallupGuestRecord,
  type ClubCallupPlayerRecord,
  type ClubCallupPlayerStatus,
  type ClubCompetitionRecord,
  type ClubFinancialSummary,
  type ClubLineupRecord,
  type ClubMatchPaymentRecord,
  type ClubMatchRecord,
  type ClubPlayerPosition,
  type ClubPlayerRecord,
  type ClubTeamPlayerRecord,
  type ClubTeamRecord
} from "@/lib/domain/clubs";
import {
  CLUB_SITE_SECTION_KEYS,
  buildClubSitePublicHref,
  type ClubProductRecord,
  type ClubProductStatus
} from "@/lib/domain/club-sites";
import {
  getClubProductImageUrl,
  getClubSiteHeroUrl,
  MAX_CLUB_PRODUCT_IMAGE_SIZE_MB,
  MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB
} from "@/lib/club-site-media";
import { getAdminClubDetails } from "@/lib/queries/clubs";
import { getClubLogoUrl } from "@/lib/team-logos";

function buildAdminInviteUrl(inviteToken: string) {
  const pathname = `/admin/clubs/invite/${inviteToken}`;
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return pathname;
  return new URL(pathname, appUrl.replace(/\/+$/, "")).toString();
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Buenos_Aires"
  }).format(new Date(value));
}

function formatCurrencyCents(cents: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    style: "currency"
  }).format(cents / 100);
}

function getTeamName(teamId: string, teams: ClubTeamRecord[]) {
  return teams.find((team) => team.id === teamId)?.name ?? "Equipo";
}

function getPaymentStatusLabel(status: ReturnType<typeof getClubPaymentStatus>) {
  switch (status) {
    case "paid":
      return "Pagado";
    case "partial":
      return "Parcial";
    case "unpaid":
      return "Debe";
  }
}

function getPaymentStatusClass(status: ReturnType<typeof getClubPaymentStatus>) {
  switch (status) {
    case "paid":
      return "bg-emerald-500/15 text-emerald-200";
    case "partial":
      return "bg-amber-500/15 text-amber-200";
    case "unpaid":
      return "bg-rose-500/15 text-rose-200";
  }
}

function formatCurrencyInput(cents: number | null | undefined) {
  if (!cents) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

function getCallupPlayerStatusLabel(status: ClubCallupPlayerStatus | "") {
  switch (status) {
    case "confirmed":
      return "Confirmado";
    case "tentative":
      return "Dudoso";
    case "out":
      return "Baja";
    case "injured":
      return "Lesionado";
    case "waitlist":
      return "Espera";
    default:
      return "Sin cargar";
  }
}

function getCallupPlayerStatusClass(status: ClubCallupPlayerStatus | "") {
  switch (status) {
    case "confirmed":
      return "bg-emerald-500/15 text-emerald-200";
    case "tentative":
      return "bg-amber-500/15 text-amber-200";
    case "injured":
      return "bg-rose-500/15 text-rose-200";
    case "out":
      return "bg-slate-600/40 text-slate-200";
    case "waitlist":
      return "bg-sky-500/15 text-sky-200";
    default:
      return "bg-slate-800 text-slate-300";
  }
}

const CALLUP_PLAYER_STATUS_OPTIONS: Array<{ value: ClubCallupPlayerStatus | ""; label: string }> = [
  { value: "", label: "Sin cargar" },
  { value: "confirmed", label: "Confirmado" },
  { value: "tentative", label: "Dudoso" },
  { value: "waitlist", label: "Espera" },
  { value: "injured", label: "Lesionado" },
  { value: "out", label: "Baja" }
];

const CLUB_SITE_SECTION_LABELS: Record<(typeof CLUB_SITE_SECTION_KEYS)[number], string> = {
  activity: "Actividad reciente",
  catalog: "Catalogo",
  matches: "Ultimos partidos",
  playerStats: "Tabla de jugadores",
  records: "Records",
  teamData: "Datos del equipo",
  teams: "Equipos"
};

const CLUB_PRODUCT_STATUS_OPTIONS: Array<{ label: string; value: ClubProductStatus }> = [
  { label: "Disponible", value: "available" },
  { label: "Preventa", value: "preorder" },
  { label: "Sin stock", value: "sold_out" },
  { label: "Oculto", value: "hidden" }
];

function getProductStatusLabel(status: string) {
  return CLUB_PRODUCT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Disponible";
}

function getProductStatusClass(status: string) {
  switch (status) {
    case "sold_out":
      return "bg-amber-500/15 text-amber-200";
    case "preorder":
      return "bg-sky-500/15 text-sky-200";
    case "hidden":
      return "bg-slate-700 text-slate-300";
    default:
      return "bg-emerald-500/15 text-emerald-200";
  }
}

function ModalityBadge({ modality }: { modality: ClubTeamRecord["modality"] }) {
  return (
    <Badge className="bg-sky-500/15 text-sky-200">
      {formatMatchModality(modality)}
    </Badge>
  );
}

function formatPlayerMeta(player: ClubPlayerRecord) {
  return [
    player.nickname,
    formatClubPlayerPosition(player.position),
    player.shirt_number ? `#${player.shirt_number}` : null,
    player.notes
  ].filter(Boolean).join(" - ");
}

type TeamRosterFilters = {
  availablePosition: ClubPlayerPosition | null;
  availableSearch: string;
  rosterPosition: ClubPlayerPosition | null;
  rosterSearch: string;
};

type ClubPlayersView = "new" | "bulk" | "pool";
type SiteProductPanel = "products" | "new";
type SiteProductStatusFilter = "all" | ClubProductStatus;
type SiteProductFilters = {
  category: string;
  search: string;
  status: SiteProductStatusFilter;
};

function normalizeClubPlayersView(view?: string): ClubPlayersView | null {
  return view === "new" || view === "bulk" || view === "pool" ? view : null;
}

function normalizeSiteProductPanel(panel?: string): SiteProductPanel {
  return panel === "new" ? "new" : "products";
}

function normalizeSiteProductStatusFilter(status?: string): SiteProductStatusFilter {
  return status === "available" || status === "sold_out" || status === "preorder" || status === "hidden"
    ? status
    : "all";
}

function buildSiteProductPath({
  clubId,
  filters,
  panel
}: {
  clubId: string;
  filters?: Partial<SiteProductFilters>;
  panel: SiteProductPanel;
}) {
  const searchParams = new URLSearchParams({
    sitePanel: panel,
    tab: "site"
  });
  if (filters?.search?.trim()) searchParams.set("productSearch", filters.search.trim());
  if (filters?.category?.trim()) searchParams.set("productCategory", filters.category.trim());
  if (filters?.status && filters.status !== "all") searchParams.set("productStatus", filters.status);
  return `/admin/clubs/${clubId}?${searchParams.toString()}`;
}

function productMatchesSiteFilters(product: ClubProductRecord, filters: SiteProductFilters) {
  const search = filters.search.trim().toLowerCase();
  const matchesSearch = !search ||
    [product.name, product.category, product.price_label, product.description]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search));
  const matchesCategory = !filters.category || product.category === filters.category;
  const matchesStatus = filters.status === "all"
    ? true
    : filters.status === "hidden"
      ? !product.visible || product.status === "hidden"
      : product.status === filters.status;

  return matchesSearch && matchesCategory && matchesStatus;
}

function buildClubPlayersPath({
  clubId,
  position,
  view
}: {
  clubId: string;
  position?: ClubPlayerPosition | null;
  view?: ClubPlayersView | null;
}) {
  const searchParams = new URLSearchParams({
    tab: "players"
  });
  if (view) searchParams.set("view", view);
  if (position) searchParams.set("position", position);
  return `/admin/clubs/${clubId}?${searchParams.toString()}`;
}

function getClubPlayersActionLinkClass(active: boolean) {
  return active ? adminContextPrimaryActionLinkClass : adminContextActionLinkClass;
}

function buildTeamRosterPath({
  availablePosition,
  availableSearch,
  clubId,
  rosterPosition,
  rosterSearch,
  teamId
}: TeamRosterFilters & {
  clubId: string;
  teamId: string;
}) {
  const searchParams = new URLSearchParams({
    tab: "teams",
    teamId
  });
  if (rosterPosition) searchParams.set("rosterPosition", rosterPosition);
  if (availablePosition) searchParams.set("availablePosition", availablePosition);
  if (rosterSearch.trim()) searchParams.set("rosterSearch", rosterSearch.trim());
  if (availableSearch.trim()) searchParams.set("availableSearch", availableSearch.trim());
  return `/admin/clubs/${clubId}?${searchParams.toString()}`;
}

function PositionFilterLinks({
  clubId,
  filters,
  selectedPosition,
  target,
  teamId
}: {
  clubId: string;
  filters: TeamRosterFilters;
  selectedPosition: ClubPlayerPosition | null;
  target: "available" | "roster";
  teamId: string;
}) {
  const buildHref = (position: ClubPlayerPosition | null) =>
    buildTeamRosterPath({
      ...filters,
      availablePosition: target === "available" ? position : filters.availablePosition,
      clubId,
      rosterPosition: target === "roster" ? position : filters.rosterPosition,
      teamId
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        className={
          selectedPosition
            ? "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300"
            : "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"
        }
        href={buildHref(null)}
      >
        Todos
      </Link>
      {CLUB_PLAYER_POSITIONS.map((position) => (
        <Link
          className={
            selectedPosition === position
              ? "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"
              : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300"
          }
          href={buildHref(position)}
          key={position}
        >
          {formatClubPlayerPosition(position)}
        </Link>
      ))}
    </div>
  );
}

function RosterSearchForm({
  fieldName,
  filters,
  placeholder,
  teamId
}: {
  fieldName: "availableSearch" | "rosterSearch";
  filters: TeamRosterFilters;
  placeholder: string;
  teamId: string;
}) {
  return (
    <form className="flex flex-col gap-2 sm:flex-row" method="get">
      <input name="tab" type="hidden" value="teams" />
      <input name="teamId" type="hidden" value={teamId} />
      {filters.rosterPosition ? <input name="rosterPosition" type="hidden" value={filters.rosterPosition} /> : null}
      {filters.availablePosition ? <input name="availablePosition" type="hidden" value={filters.availablePosition} /> : null}
      {fieldName === "availableSearch" && filters.rosterSearch.trim() ? (
        <input name="rosterSearch" type="hidden" value={filters.rosterSearch.trim()} />
      ) : null}
      {fieldName === "rosterSearch" && filters.availableSearch.trim() ? (
        <input name="availableSearch" type="hidden" value={filters.availableSearch.trim()} />
      ) : null}
      <Input
        defaultValue={fieldName === "availableSearch" ? filters.availableSearch : filters.rosterSearch}
        name={fieldName}
        placeholder={placeholder}
      />
      <Button className="sm:w-fit" type="submit" variant="secondary">
        Buscar
      </Button>
    </form>
  );
}

function Feedback({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return (
    <Card>
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      {success ? <p className="text-sm font-semibold text-emerald-300">{success}</p> : null}
    </Card>
  );
}

function TabLink({
  active,
  children,
  href
}: {
  active: boolean;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      className={
        active
          ? "shrink-0 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-200"
          : "shrink-0 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800"
      }
      href={href}
    >
      {children}
    </Link>
  );
}

function SummaryTab({
  clubId,
  details
}: {
  clubId: string;
  details: NonNullable<Awaited<ReturnType<typeof getAdminClubDetails>>>;
}) {
  const snapshot = details.publicSnapshot;

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Card>
          <CardDescription>Equipos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.teamCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Jugadores</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.playerCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Partidos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.playedMatches}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Goles a favor</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.goalsFor}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Goles en contra</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.goalsAgainst}</CardTitle>
        </Card>
      </section>

      <Card>
        <CardTitle>Escudo del club</CardTitle>
        <CardDescription className="mt-2">
          Este escudo lo heredan todos los equipos del club.
        </CardDescription>
        <div className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:flex-row sm:items-center">
          <LeagueLogo
            alt={`Escudo de ${details.club.name}`}
            size={64}
            src={getClubLogoUrl(clubId)}
          />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-100">Escudo actual</p>
            <p className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP o SVG.</p>
            <details className="mt-3">
              <summary className="inline-flex w-fit cursor-pointer list-none items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300">
                Cambiar escudo
              </summary>
              <form action={uploadClubLogoAction.bind(null, clubId)} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input accept="image/jpeg,image/png,image/webp,image/svg+xml" className="max-w-72" name="logo" type="file" />
                <Button className="w-fit" type="submit" variant="secondary">
                  Guardar escudo
                </Button>
              </form>
            </details>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Configuracion general</CardTitle>
        <CardDescription className="mt-2">
          Estos datos alimentan la vista por URL privada del club. Por ahora solo la pueden abrir el super admin y los admins del club.
        </CardDescription>
        <form action={updateClubAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
              Nombre
            </label>
            <Input defaultValue={details.club.name} id="name" name="name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="homeVenue">
              Sede habitual
            </label>
            <Input defaultValue={details.club.home_venue ?? ""} id="homeVenue" name="homeVenue" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="description">
              Descripcion
            </label>
            <Textarea defaultValue={details.club.description ?? ""} id="description" name="description" rows={4} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Guardar club</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function PlayersTab({
  clubId,
  playerView,
  players,
  selectedPosition
}: {
  clubId: string;
  playerView: ClubPlayersView | null;
  players: ClubPlayerRecord[];
  selectedPosition: ClubPlayerPosition | null;
}) {
  const showCreateForm = playerView === "new";
  const showBulkForm = playerView === "bulk";
  const showPool = playerView === "pool";
  const filteredPlayers = selectedPosition
    ? players.filter((player) => player.position === selectedPosition)
    : players;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Jugadores</CardTitle>
            <CardDescription className="mt-1">
              {players.length} jugadores cargados en el club.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className={getClubPlayersActionLinkClass(showCreateForm)}
              href={buildClubPlayersPath({ clubId, view: "new" })}
            >
              Agregar
            </Link>
            <Link
              className={getClubPlayersActionLinkClass(showBulkForm)}
              href={buildClubPlayersPath({ clubId, view: "bulk" })}
            >
              Agregar masivo
            </Link>
            <Link
              className={getClubPlayersActionLinkClass(showPool)}
              href={buildClubPlayersPath({ clubId, view: "pool" })}
            >
              Ver pool
            </Link>
          </div>
        </div>
      </Card>

      {showCreateForm ? (
        <Card>
          <CardTitle>Nuevo jugador</CardTitle>
          <form action={addClubPlayerAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
              <Input name="fullName" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Apodo</label>
              <Input name="nickname" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Posicion</label>
              <Select name="position">
                <option value="">Sin posicion</option>
                {CLUB_PLAYER_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {formatClubPlayerPosition(position)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Numero</label>
              <Input min={1} max={99} name="shirtNumber" type="number" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
              <Textarea name="notes" rows={2} />
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Agregar jugador</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {showBulkForm ? (
        <Card>
          <CardTitle>Carga masiva</CardTitle>
          <CardDescription className="mt-2">
            Cada salto de linea crea otro jugador. Dentro de cada linea, separa los datos con <span className="font-mono">;</span>.
          </CardDescription>
          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Formato</p>
            <p className="mt-1 text-xs text-slate-400">Nombre;Apodo;Posicion;Numero;Nota</p>
            <pre className="mt-2 whitespace-pre-wrap font-mono text-xs text-slate-400">
{`Juan Perez;Juani;Delantero;9;Zurdo
Nicolas Gomez;Nico;Arquero;1;
Martin Alvarez`}
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              El salto de linea cambia de jugador; el punto y coma separa campos. Posicion solo puede ser Arquero, Defensor, Volante o Delantero.
            </p>
          </div>
          <form action={bulkAddClubPlayersAction.bind(null, clubId)} className="mt-4 space-y-3">
            <Textarea
              name="players"
              placeholder={"Juan Perez;Juani;Delantero;9;Zurdo\nNicolas Gomez;Nico;Arquero;1;\nMartin Alvarez"}
              rows={8}
            />
            <Button type="submit" variant="secondary">
              Cargar jugadores
            </Button>
          </form>
        </Card>
      ) : null}

      {showPool ? (
        <Card>
          <CardTitle>Pool del club</CardTitle>
          <CardDescription className="mt-2">
            Desactivar no borra al jugador: lo deja fuera del pool activo y puedes volver a activarlo. Los pagos se definen en cada convocatoria.
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className={
                selectedPosition
                  ? "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-300"
                  : "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-200"
              }
              href={buildClubPlayersPath({ clubId, view: "pool" })}
            >
              Todos
            </Link>
            {CLUB_PLAYER_POSITIONS.map((position) => (
              <Link
                className={
                  selectedPosition === position
                    ? "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-200"
                    : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-300"
                }
                href={buildClubPlayersPath({ clubId, position, view: "pool" })}
                key={position}
              >
                {formatClubPlayerPosition(position)}
              </Link>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Foto</TH>
                  <TH>Jugador</TH>
                  <TH>Datos</TH>
                  <TH>Estado</TH>
                  <TH>Accion</TH>
                </tr>
              </THead>
              <TBody>
                {filteredPlayers.map((player) => (
                  <tr key={player.id}>
                    <TD>
                      <PlayerAvatar name={player.full_name} playerId={player.id} size="sm" />
                    </TD>
                    <TD className="font-semibold">{player.full_name}</TD>
                    <TD className="text-slate-300">
                      {formatPlayerMeta(player) || "Sin detalle"}
                    </TD>
                    <TD>
                      <Badge className={player.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
                        {player.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-2">
                        <form action={uploadClubPlayerPhotoAction.bind(null, clubId)} className="flex flex-col gap-2">
                          <input name="playerId" type="hidden" value={player.id} />
                          <Input accept="image/jpeg,image/png,image/webp" className="max-w-48" name="photo" type="file" />
                          <Button className="h-8 w-fit px-3 text-xs" type="submit" variant="secondary">
                            Subir foto
                          </Button>
                        </form>
                        <form action={toggleClubPlayerAction.bind(null, clubId)}>
                          <input name="playerId" type="hidden" value={player.id} />
                          <input name="active" type="hidden" value={player.active ? "false" : "true"} />
                          <Button className="h-8 px-3 text-xs" type="submit" variant="ghost">
                            {player.active ? "Desactivar" : "Activar"}
                          </Button>
                        </form>
                      </div>
                    </TD>
                  </tr>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function TeamsTab({
  clubId,
  players,
  teamPlayers,
  teams
}: {
  clubId: string;
  players: ClubPlayerRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
  teams: ClubTeamRecord[];
}) {
  return (
    <div className="space-y-4">
      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Equipos</CardTitle>
            <CardDescription className="mt-1">Cada club puede tener hasta 5 equipos activos.</CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
            Nuevo equipo
          </span>
        </summary>
        <form action={addClubTeamAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
            <Input name="name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre corto</label>
            <Input name="shortName" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Modalidad</label>
            <Select defaultValue="11v11" name="modality" required>
              {MATCH_MODALITIES.map((modality) => (
                <option key={modality} value={modality}>
                  {formatMatchModality(modality)}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Textarea name="notes" rows={2} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Agregar equipo</Button>
          </div>
        </form>
      </details>

      <section className="grid gap-3 lg:grid-cols-2">
        {teams.map((team) => {
          const rosterOptions = buildClubTeamRosterOptions({
            players,
            teamId: team.id,
            teamPlayers
          });
          return (
            <Card key={team.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <LeagueLogo
                    alt={`Escudo de ${team.name}`}
                    src={getClubLogoUrl(clubId)}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="truncate">{team.name}</CardTitle>
                      <ModalityBadge modality={team.modality} />
                      <Badge className={team.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
                        {team.active ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      {team.short_name ? `${team.short_name} - ` : ""}{rosterOptions.rosterPlayers.length} jugadores. Usa el escudo del club.
                    </CardDescription>
                  </div>
                </div>
                <Link
                  className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
                  href={`/admin/clubs/${clubId}?tab=teams&teamId=${team.id}`}
                >
                  Gestionar plantel
                </Link>
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

function TeamRosterTab({
  clubId,
  filters,
  players,
  team,
  teamPlayers
}: {
  clubId: string;
  filters: TeamRosterFilters;
  players: ClubPlayerRecord[];
  team: ClubTeamRecord;
  teamPlayers: ClubTeamPlayerRecord[];
}) {
  const rosterOptions = buildClubTeamRosterOptions({
    players,
    teamId: team.id,
    teamPlayers
  });
  const filteredRosterPlayers = filterClubPlayersForRosterManagement(rosterOptions.rosterPlayers, {
    position: filters.rosterPosition,
    search: filters.rosterSearch
  });
  const filteredAvailablePlayers = filterClubPlayersForRosterManagement(rosterOptions.availablePlayers, {
    position: filters.availablePosition,
    search: filters.availableSearch
  });
  const hasAvailablePlayers = filteredAvailablePlayers.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <LeagueLogo
              alt={`Escudo de ${team.name}`}
              src={getClubLogoUrl(clubId)}
            />
            <div>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription className="mt-1">
                {team.short_name ? `${team.short_name} - ` : ""}{rosterOptions.rosterPlayers.length} jugadores en el plantel.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ModalityBadge modality={team.modality} />
            <Badge className={team.active ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-800 text-slate-300"}>
              {team.active ? "Activo" : "Inactivo"}
            </Badge>
            <Link
              className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-slate-100 transition hover:border-emerald-400/60 hover:text-emerald-300"
              href={`/admin/clubs/${clubId}?tab=teams`}
            >
              Volver a equipos
            </Link>
          </div>
        </div>
        <form action={updateClubTeamAction.bind(null, clubId)} className="mt-5 grid gap-3 md:grid-cols-2">
          <input name="teamId" type="hidden" value={team.id} />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
            <Input defaultValue={team.name} name="name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre corto</label>
            <Input defaultValue={team.short_name ?? ""} name="shortName" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Modalidad</label>
            <Select defaultValue={team.modality} name="modality" required>
              {MATCH_MODALITIES.map((modality) => (
                <option key={modality} value={modality}>
                  {formatMatchModality(modality)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Estado</label>
            <Select defaultValue={team.active ? "true" : "false"} name="active">
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Textarea defaultValue={team.notes ?? ""} name="notes" rows={2} />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="secondary">
              Guardar equipo
            </Button>
          </div>
        </form>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Plantel actual</CardTitle>
              <CardDescription className="mt-1">
                Quita jugadores solo desde el plantel de este equipo.
              </CardDescription>
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {filteredRosterPlayers.length}/{rosterOptions.rosterPlayers.length}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <RosterSearchForm
              fieldName="rosterSearch"
              filters={filters}
              placeholder="Buscar en este plantel"
              teamId={team.id}
            />
            <PositionFilterLinks
              clubId={clubId}
              filters={filters}
              selectedPosition={filters.rosterPosition}
              target="roster"
              teamId={team.id}
            />
          </div>
          <div className="mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
            {filteredRosterPlayers.length ? (
              filteredRosterPlayers.map((player) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                  key={player.id}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{player.full_name}</p>
                    <p className="truncate text-xs text-slate-400">{formatPlayerMeta(player) || "Sin detalle"}</p>
                  </div>
                  <form action={removeClubTeamPlayerAction.bind(null, clubId)}>
                    <input name="teamId" type="hidden" value={team.id} />
                    <input name="playerId" type="hidden" value={player.id} />
                    <Button className="h-8 px-3 text-xs" type="submit" variant="ghost">
                      Quitar
                    </Button>
                  </form>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-400">
                No hay jugadores que coincidan con el filtro.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Agregar jugadores</CardTitle>
              <CardDescription className="mt-1">
                Solo aparecen jugadores activos del club que todavia no estan en este equipo.
              </CardDescription>
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {filteredAvailablePlayers.length}/{rosterOptions.availablePlayers.length}
            </p>
          </div>
          <div className="mt-4 space-y-3">
            <RosterSearchForm
              fieldName="availableSearch"
              filters={filters}
              placeholder="Buscar para agregar"
              teamId={team.id}
            />
            <PositionFilterLinks
              clubId={clubId}
              filters={filters}
              selectedPosition={filters.availablePosition}
              target="available"
              teamId={team.id}
            />
          </div>
          <form action={addClubTeamPlayersAction.bind(null, clubId)} className="mt-4 space-y-4">
            <input name="teamId" type="hidden" value={team.id} />
            <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {filteredAvailablePlayers.length ? (
                filteredAvailablePlayers.map((player) => (
                  <label
                    className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-200"
                    key={player.id}
                  >
                    <input
                      className="mt-0.5 h-4 w-4 accent-emerald-400"
                      name="playerIds"
                      type="checkbox"
                      value={player.id}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{player.full_name}</span>
                      <span className="block truncate text-xs text-slate-500">{formatPlayerMeta(player) || "Sin detalle"}</span>
                    </span>
                  </label>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-400">
                  No hay jugadores disponibles que coincidan con el filtro.
                </p>
              )}
            </div>
            <Button disabled={!hasAvailablePlayers} type="submit" variant="secondary">
              Agregar seleccionados
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}

function CompetitionsTab({
  clubId,
  competitions
}: {
  clubId: string;
  competitions: ClubCompetitionRecord[];
}) {
  return (
    <div className="space-y-4">
      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Torneos del club</CardTitle>
            <CardDescription className="mt-1">
              Usa estos torneos para clasificar partidos como Copa Premier, LAFAB o amistosos.
            </CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
            Nuevo torneo
          </span>
        </summary>
        <form action={addClubCompetitionAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-[1fr_1.4fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
            <Input name="name" placeholder="Copa Premier" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Input name="notes" placeholder="Opcional" />
          </div>
          <div className="flex items-end">
            <Button type="submit">Agregar</Button>
          </div>
        </form>
      </details>

      <Card>
        <CardTitle>Actuales</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <TH>Torneo</TH>
                <TH>Notas</TH>
                <TH>Accion</TH>
              </tr>
            </THead>
            <TBody>
              {competitions.map((competition) => (
                <tr key={competition.id}>
                  <TD>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{competition.name}</span>
                      {!competition.active ? (
                        <Badge className="bg-slate-800 text-slate-300">Inactivo</Badge>
                      ) : null}
                    </div>
                  </TD>
                  <TD className="text-slate-300">{competition.notes?.trim() || "-"}</TD>
                  <TD>
                    <form action={toggleClubCompetitionAction.bind(null, clubId)}>
                      <input name="competitionId" type="hidden" value={competition.id} />
                      <input name="active" type="hidden" value={competition.active ? "false" : "true"} />
                      {competition.active ? (
                        <ConfirmSubmitButton
                          className="h-8 px-3 text-xs"
                          confirmMessage={`Seguro que quieres dar de baja ${competition.name}? No se borra el historial, pero no aparecera para nuevos partidos.`}
                          label="Dar de baja"
                          variant="ghost"
                        />
                      ) : (
                        <Button className="h-8 px-3 text-xs" type="submit" variant="secondary">
                          Reactivar
                        </Button>
                      )}
                    </form>
                  </TD>
                </tr>
              ))}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function formatCentsInputValue(cents: number) {
  if (cents <= 0) return "";
  const amount = cents / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

type CallupSourceFilter = "team" | "other" | "free" | "all";
type CallupSortMode = "position" | "name";

type CallupFilters = {
  position: ClubPlayerPosition | null;
  search: string;
  sort: CallupSortMode;
  source: CallupSourceFilter;
};

const CALLUP_SOURCE_OPTIONS: Array<{ value: CallupSourceFilter; label: string }> = [
  { value: "team", label: "Equipo" },
  { value: "other", label: "Otros equipos" },
  { value: "free", label: "Sin equipo" },
  { value: "all", label: "Todos" }
];

const CALLUP_PAYMENT_OPTIONS = [
  { value: "full", label: "Completo" },
  { value: "partial", label: "Parte" },
  { value: "none", label: "No paga" }
];

function normalizeCallupSourceFilter(value?: string): CallupSourceFilter {
  if (value === "other" || value === "free" || value === "all") return value;
  return "team";
}

function normalizeCallupSortMode(value?: string): CallupSortMode {
  return value === "name" ? "name" : "position";
}

function buildCallupPath({
  callupId,
  clubId,
  filters
}: {
  callupId?: string | null;
  clubId: string;
  filters: CallupFilters;
}) {
  const searchParams = new URLSearchParams({
    tab: "callups",
    callupSource: filters.source,
    callupSort: filters.sort
  });
  if (callupId) searchParams.set("callupId", callupId);
  if (filters.position) searchParams.set("callupPosition", filters.position);
  if (filters.search.trim()) searchParams.set("callupSearch", filters.search.trim());
  return `/admin/clubs/${clubId}?${searchParams.toString()}`;
}

function getCallupFilterLinkClass(active: boolean) {
  return active
    ? "rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"
    : "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:bg-slate-800";
}

function getCallupPaymentMode(expectedCents: number | null | undefined, fullPaymentCents: number) {
  if (expectedCents == null) return "full";
  if (expectedCents <= 0) return "none";
  if (expectedCents === fullPaymentCents) return "full";
  return "partial";
}

function getCallupPaymentModeLabel(mode: ReturnType<typeof getCallupPaymentMode>) {
  return CALLUP_PAYMENT_OPTIONS.find((option) => option.value === mode)?.label ?? "Completo";
}

function comparePlayersByPosition(left: ClubPlayerRecord, right: ClubPlayerRecord) {
  const leftPosition = normalizeClubPlayerPosition(left.position);
  const rightPosition = normalizeClubPlayerPosition(right.position);
  const leftIndex = leftPosition ? CLUB_PLAYER_POSITIONS.indexOf(leftPosition) : CLUB_PLAYER_POSITIONS.length;
  const rightIndex = rightPosition ? CLUB_PLAYER_POSITIONS.indexOf(rightPosition) : CLUB_PLAYER_POSITIONS.length;
  if (leftIndex !== rightIndex) return leftIndex - rightIndex;
  return left.full_name.localeCompare(right.full_name, "es");
}

function CallupsTab({
  clubId,
  details,
  filters,
  selectedCallupId
}: {
  clubId: string;
  details: NonNullable<Awaited<ReturnType<typeof getAdminClubDetails>>>;
  filters: CallupFilters;
  selectedCallupId: string | null;
}) {
  const activeTeams = details.teams.filter((team) => team.active);
  const activePlayers = details.players.filter((player) => player.active);
  const selectedCallup =
    details.callups.find((callup) => callup.id === selectedCallupId) ??
    details.callups.find((callup) => callup.status === "draft") ??
    details.callups[0] ??
    null;
  const callupEntries = selectedCallup
    ? details.callupPlayers.filter((entry) => entry.callup_id === selectedCallup.id)
    : [];
  const selectedCallupGuests = selectedCallup
    ? details.callupGuests.filter((guest) => guest.callup_id === selectedCallup.id)
    : [];
  const entriesByPlayerId = new Map(callupEntries.map((entry) => [entry.club_player_id, entry]));
  const selectedSummary = selectedCallup
    ? details.callupSummaries[selectedCallup.id] ?? buildClubCallupSummary({
        callup: selectedCallup,
        entries: callupEntries,
        guests: selectedCallupGuests,
        players: details.players
      })
    : null;
  const defaultScheduledDate = getCurrentMatchDateInput();
  const selectedTeamPlayerIds = new Set(
    selectedCallup
      ? details.teamPlayers
          .filter((teamPlayer) => teamPlayer.club_team_id === selectedCallup.club_team_id)
          .map((teamPlayer) => teamPlayer.club_player_id)
      : []
  );
  const playerTeamIdsByPlayerId = new Map<string, Set<string>>();
  for (const teamPlayer of details.teamPlayers) {
    const teamIds = playerTeamIdsByPlayerId.get(teamPlayer.club_player_id) ?? new Set<string>();
    teamIds.add(teamPlayer.club_team_id);
    playerTeamIdsByPlayerId.set(teamPlayer.club_player_id, teamIds);
  }
  const sourceCounts: Record<CallupSourceFilter, number> = {
    all: activePlayers.length,
    free: activePlayers.filter((player) => !playerTeamIdsByPlayerId.get(player.id)?.size).length,
    other: activePlayers.filter((player) => {
      const teamIds = playerTeamIdsByPlayerId.get(player.id);
      return Boolean(teamIds?.size) && !selectedTeamPlayerIds.has(player.id);
    }).length,
    team: activePlayers.filter((player) => selectedTeamPlayerIds.has(player.id)).length
  };
  const normalizedSearch = filters.search.trim().toLocaleLowerCase("es-AR");
  const filteredPlayers = activePlayers
    .filter((player) => {
      const teamIds = playerTeamIdsByPlayerId.get(player.id);
      const matchesSource = filters.source === "all"
        || (filters.source === "team" && selectedTeamPlayerIds.has(player.id))
        || (filters.source === "other" && Boolean(teamIds?.size) && !selectedTeamPlayerIds.has(player.id))
        || (filters.source === "free" && !teamIds?.size);
      const playerPosition = normalizeClubPlayerPosition(player.position);
      const matchesPosition = !filters.position || playerPosition === filters.position;
      const matchesSearch = !normalizedSearch
        || player.full_name.toLocaleLowerCase("es-AR").includes(normalizedSearch)
        || (player.nickname ?? "").toLocaleLowerCase("es-AR").includes(normalizedSearch);
      return matchesSource && matchesPosition && matchesSearch;
    })
    .sort(filters.sort === "position"
      ? comparePlayersByPosition
      : (left, right) => left.full_name.localeCompare(right.full_name, "es"));
  const selectedTeamName = selectedCallup ? getTeamName(selectedCallup.club_team_id, details.teams) : "Equipo";
  const callupSelectionFilters: CallupFilters = {
    position: null,
    search: "",
    sort: "position",
    source: "team"
  };

  return (
    <div className="space-y-4">
      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4" open={!selectedCallup}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Nueva convocatoria</CardTitle>
            <CardDescription className="mt-1">
              Crea la lista previa para controlar cupo, plata y posiciones antes del partido.
            </CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
            Crear
          </span>
        </summary>
        <form action={addClubCallupAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Equipo</label>
            <Select name="teamId" required>
              <option value="">Elegir equipo</option>
              {activeTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} - {formatMatchModality(team.modality)}
                </option>
              ))}
            </Select>
          </div>
          <MatchDateTimeFields
            dateName="scheduledDate"
            defaultDate={defaultScheduledDate}
            requiredTime
            timeName="scheduledTime"
          />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Rival</label>
            <Input name="opponentName" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Lugar / cancha</label>
            <Input defaultValue={details.club.home_venue ?? ""} name="venue" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Costo cancha</label>
            <Input min={0} name="fieldCostAmount" placeholder="36000" step="0.01" type="number" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Jugadores ideal</label>
            <Input defaultValue={14} min={1} max={30} name="idealPlayerCount" type="number" />
            <p className="mt-1 text-xs text-slate-400">El pago completo se estima con cancha / ideal.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Maximo jugadores</label>
            <Input defaultValue={16} min={1} max={30} name="maxPlayerCount" type="number" />
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Textarea name="notes" rows={2} />
          </div>
          <div className="md:col-span-3">
            <Button type="submit">Crear convocatoria</Button>
          </div>
        </form>
      </details>

      {details.callups.length ? (
        <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <div>
              <CardTitle>Convocatorias cargadas</CardTitle>
              <CardDescription className="mt-1">Abrir una convocatoria muestra solo su detalle debajo.</CardDescription>
            </div>
            <span className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200">
              Ver lista
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            {details.callups.map((callup) => {
              const summary = details.callupSummaries[callup.id];

              return (
                <Link
                  className={
                    selectedCallup?.id === callup.id
                      ? "block rounded-xl border border-emerald-400/60 bg-emerald-500/10 p-4 text-emerald-100"
                      : "block rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-slate-200 transition hover:border-slate-600 hover:bg-slate-900"
                  }
                  href={buildCallupPath({ callupId: callup.id, clubId, filters: callupSelectionFilters })}
                  key={callup.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {getTeamName(callup.club_team_id, details.teams)} - {formatDateTime(callup.scheduled_at)}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {callup.opponent_name ? `Rival: ${callup.opponent_name}` : "Rival sin cargar"}
                        {callup.venue ? ` - ${callup.venue}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {summary?.confirmedCount ?? 0}/{callup.ideal_player_count} confirmados
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </details>
      ) : null}

      {selectedCallup && selectedSummary ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardDescription>Confirmados</CardDescription>
              <CardTitle className="mt-1 text-3xl">
                {selectedSummary.confirmedCount}/{selectedCallup.ideal_player_count}
              </CardTitle>
              <p className="mt-1 text-xs text-slate-400">Maximo {selectedCallup.max_player_count}</p>
            </Card>
            <Card>
              <CardDescription>Pago estimado</CardDescription>
              <CardTitle className="mt-1 text-3xl">{formatCurrencyCents(selectedCallup.full_payment_cents)}</CardTitle>
              <p className="mt-1 text-xs text-slate-400">
                {formatCurrencyCents(selectedCallup.field_cost_cents)} / {selectedCallup.ideal_player_count}
              </p>
            </Card>
            <Card>
              <CardDescription>Falta cubrir</CardDescription>
              <CardTitle className="mt-1 text-3xl">{formatCurrencyCents(selectedSummary.revenueMissingCents)}</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Objetivo {formatCurrencyCents(selectedSummary.targetRevenueCents)}</p>
            </Card>
            <Card>
              <CardDescription>Dudosos / espera</CardDescription>
              <CardTitle className="mt-1 text-3xl">
                {selectedSummary.tentativeCount}/{selectedSummary.waitlistCount}
              </CardTitle>
              <p className="mt-1 text-xs text-slate-400">Bajas {selectedSummary.outCount + selectedSummary.injuredCount}</p>
            </Card>
          </section>

          <Card>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>
                  {selectedTeamName} - {formatDateTime(selectedCallup.scheduled_at)}
                </CardTitle>
                <CardDescription className="mt-2">
                  {selectedCallup.opponent_name ? `Rival: ${selectedCallup.opponent_name}` : "Rival sin cargar"}
                  {selectedCallup.venue ? ` - ${selectedCallup.venue}` : ""}
                </CardDescription>
              </div>
              <Badge className="bg-sky-500/15 text-sky-200">{selectedCallup.status}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-sm font-semibold text-slate-100">Diagnostico</p>
                <ul className="mt-2 space-y-1 text-sm text-slate-300">
                  {selectedSummary.recommendations.map((recommendation) => (
                    <li key={recommendation}>{recommendation}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-sm font-semibold text-slate-100">Faltantes por posicion</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSummary.positionNeeds.length ? (
                    selectedSummary.positionNeeds.map((need) => (
                      <Badge className="bg-amber-500/15 text-amber-200" key={need.position}>
                        {need.needed} {need.label}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">Posiciones base cubiertas.</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardTitle>Sugeridos</CardTitle>
            <CardDescription className="mt-2">
              Activos fuera de esta convocatoria que cubren posiciones faltantes.
            </CardDescription>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {selectedSummary.candidateSuggestions.map((candidate) => (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3" key={candidate.playerId}>
                  <p className="font-semibold text-slate-100">{candidate.displayName}</p>
                  <p className="mt-1 text-sm text-slate-400">{candidate.reason}</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {candidate.positionLabel} - {formatCurrencyCents(candidate.expectedCents)}
                  </p>
                </div>
              ))}
              {!selectedSummary.candidateSuggestions.length ? (
                <p className="text-sm text-slate-400">No hay candidatos claros fuera de la convocatoria.</p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardTitle>Lista de jugadores</CardTitle>
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {CALLUP_SOURCE_OPTIONS.map((option) => (
                  <Link
                    className={getCallupFilterLinkClass(filters.source === option.value)}
                    href={buildCallupPath({
                      callupId: selectedCallup.id,
                      clubId,
                      filters: { ...filters, source: option.value }
                    })}
                    key={option.value}
                  >
                    {option.label} ({sourceCounts[option.value]})
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  className={getCallupFilterLinkClass(!filters.position)}
                  href={buildCallupPath({
                    callupId: selectedCallup.id,
                    clubId,
                    filters: { ...filters, position: null }
                  })}
                >
                  Todas las posiciones
                </Link>
                {CLUB_PLAYER_POSITIONS.map((position) => (
                  <Link
                    className={getCallupFilterLinkClass(filters.position === position)}
                    href={buildCallupPath({
                      callupId: selectedCallup.id,
                      clubId,
                      filters: { ...filters, position }
                    })}
                    key={position}
                  >
                    {formatClubPlayerPosition(position)}
                  </Link>
                ))}
              </div>
              <form className="grid gap-2 md:grid-cols-[1fr_180px_auto]" method="get">
                <input name="tab" type="hidden" value="callups" />
                <input name="callupId" type="hidden" value={selectedCallup.id} />
                <input name="callupSource" type="hidden" value={filters.source} />
                {filters.position ? <input name="callupPosition" type="hidden" value={filters.position} /> : null}
                <Input defaultValue={filters.search} name="callupSearch" placeholder="Buscar por nombre" />
                <Select defaultValue={filters.sort} name="callupSort">
                  <option value="position">Ordenar por posicion</option>
                  <option value="name">Ordenar por nombre</option>
                </Select>
                <Button type="submit" variant="secondary">Aplicar</Button>
              </form>
            </div>
            <div className="mt-4 overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>Jugador</TH>
                    <TH>Posicion</TH>
                    <TH>Estado</TH>
                    <TH>Pago</TH>
                    <TH>Notas</TH>
                    <TH>Accion</TH>
                  </tr>
                </THead>
                <TBody>
                  {filteredPlayers.map((player) => {
                    const entry = entriesByPlayerId.get(player.id) as ClubCallupPlayerRecord | undefined;
                    const currentStatus = entry?.status ?? "";
                    const paymentMode = getCallupPaymentMode(entry?.expected_cents, selectedCallup.full_payment_cents);
                    const expectedCents = entry?.expected_cents ?? selectedCallup.full_payment_cents;
                    const partialValue = paymentMode === "partial" ? formatCurrencyInput(entry?.expected_cents) : "";

                    return (
                      <tr key={player.id}>
                        <TD className="font-semibold">{player.full_name}</TD>
                        <TD>{formatClubPlayerPosition(player.position) || "Sin posicion"}</TD>
                        <TD>
                          <Badge className={getCallupPlayerStatusClass(currentStatus)}>
                            {getCallupPlayerStatusLabel(currentStatus)}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge className={paymentMode === "none" ? "bg-slate-800 text-slate-300" : "bg-emerald-500/15 text-emerald-200"}>
                            {getCallupPaymentModeLabel(paymentMode)}
                          </Badge>
                          <p className="mt-1 text-xs text-slate-400">{formatCurrencyCents(expectedCents)}</p>
                        </TD>
                        <TD className="text-slate-400">{entry?.notes || player.notes || ""}</TD>
                        <TD>
                          <form action={updateClubCallupPlayerAction.bind(null, clubId)} className="flex min-w-[680px] gap-2">
                            <input name="callupId" type="hidden" value={selectedCallup.id} />
                            <input name="playerId" type="hidden" value={player.id} />
                            <input name="returnSource" type="hidden" value={filters.source} />
                            <input name="returnPosition" type="hidden" value={filters.position ?? ""} />
                            <input name="returnSearch" type="hidden" value={filters.search} />
                            <input name="returnSort" type="hidden" value={filters.sort} />
                            <Select className="w-36" defaultValue={currentStatus} name="status">
                              {CALLUP_PLAYER_STATUS_OPTIONS.map((option) => (
                                <option key={option.value || "none"} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                            <Select className="w-32" defaultValue={paymentMode} name="paymentStatus">
                              {CALLUP_PAYMENT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </Select>
                            <Input
                              aria-label={`Monto parcial ${player.full_name}`}
                              className="w-24"
                              defaultValue={partialValue}
                              min={0}
                              name="partialAmount"
                              placeholder="Parte"
                              step="0.01"
                              type="number"
                            />
                            <Input className="w-44" defaultValue={entry?.notes ?? ""} name="notes" placeholder="Nota" />
                            <Button className="h-9 px-3 text-xs" type="submit" variant="secondary">
                              Actualizar
                            </Button>
                          </form>
                        </TD>
                      </tr>
                    );
                  })}
                  {!filteredPlayers.length ? (
                    <tr>
                      <TD className="text-slate-400" colSpan={6}>No hay jugadores para esos filtros.</TD>
                    </tr>
                  ) : null}
                </TBody>
              </Table>
            </div>
          </Card>

          <Card>
            <CardTitle>Agregar invitado</CardTitle>
            <form action={addClubCallupGuestAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-6">
              <input name="callupId" type="hidden" value={selectedCallup.id} />
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
                <Input name="guestName" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Posicion</label>
                <Select name="position">
                  <option value="">Sin posicion</option>
                  {CLUB_PLAYER_POSITIONS.map((position) => (
                    <option key={position} value={position}>{formatClubPlayerPosition(position)}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Estado</label>
                <Select defaultValue="confirmed" name="status">
                  {CALLUP_PLAYER_STATUS_OPTIONS.filter((option) => option.value).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Pago</label>
                <Select defaultValue="full" name="paymentStatus">
                  {CALLUP_PAYMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200">Monto parte</label>
                <Input min={0} name="partialAmount" placeholder="Parte" step="0.01" type="number" />
              </div>
              <div className="md:col-span-5">
                <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
                <Input name="notes" />
              </div>
              <div className="flex items-end">
                <Button className="w-full" type="submit">Agregar</Button>
              </div>
            </form>

            {selectedCallupGuests.length ? (
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <THead>
                    <tr>
                      <TH>Invitado</TH>
                      <TH>Posicion</TH>
                      <TH>Estado</TH>
                      <TH>Pago</TH>
                      <TH>Notas</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {selectedCallupGuests.map((guest: ClubCallupGuestRecord) => {
                      const guestPaymentMode = getCallupPaymentMode(guest.expected_cents, selectedCallup.full_payment_cents);

                      return (
                        <tr key={guest.id}>
                          <TD className="font-semibold">
                            {guest.guest_name}
                            <Badge className="ml-2 bg-sky-500/15 text-sky-200">Temporal</Badge>
                          </TD>
                          <TD>{formatClubPlayerPosition(guest.position) || "Sin posicion"}</TD>
                          <TD>
                            <Badge className={getCallupPlayerStatusClass(guest.status)}>
                              {getCallupPlayerStatusLabel(guest.status)}
                            </Badge>
                          </TD>
                          <TD>
                            <Badge className={guestPaymentMode === "none" ? "bg-slate-800 text-slate-300" : "bg-emerald-500/15 text-emerald-200"}>
                              {getCallupPaymentModeLabel(guestPaymentMode)}
                            </Badge>
                            <p className="mt-1 text-xs text-slate-400">
                              {formatCurrencyCents(guest.expected_cents ?? selectedCallup.full_payment_cents)}
                            </p>
                          </TD>
                          <TD className="text-slate-400">{guest.notes ?? ""}</TD>
                        </tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            ) : null}
          </Card>
        </>
      ) : (
        <Card>
          <CardTitle>Sin convocatoria activa</CardTitle>
          <CardDescription className="mt-2">
            Crea la proxima fecha para empezar a marcar confirmados, bajas y aportes esperados.
          </CardDescription>
        </Card>
      )}
    </div>
  );
}

function MatchFinanceEditor({
  clubId,
  lineups,
  match,
  payments,
  returnTab
}: {
  clubId: string;
  lineups: ClubLineupRecord[];
  match: ClubMatchRecord;
  payments: ClubMatchPaymentRecord[];
  returnTab: "matches" | "finances";
}) {
  const lineupsById = new Map(lineups.map((lineup) => [lineup.id, lineup]));
  const rows = payments
    .filter((payment) => payment.match_id === match.id)
    .map((payment) => ({
      lineup: lineupsById.get(payment.lineup_id),
      payment
    }))
    .filter((row): row is { lineup: ClubLineupRecord; payment: ClubMatchPaymentRecord } => Boolean(row.lineup))
    .sort((left, right) => left.lineup.display_name.localeCompare(right.lineup.display_name, "es"));

  if (!rows.length) {
    return (
      <p className="mt-3 rounded-lg border border-dashed border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-400">
        Este partido todavia no tiene pagos de cancha cargados.
      </p>
    );
  }

  return (
    <details className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-200">
        Editar pagos de cancha
      </summary>
      <form action={updateClubMatchFinanceAction.bind(null, clubId)} className="mt-3 space-y-3">
        <input name="matchId" type="hidden" value={match.id} />
        <input name="returnTab" type="hidden" value={returnTab} />
        <div className="grid gap-2">
          {rows.map(({ lineup, payment }) => {
            const status = getClubPaymentStatus(payment);
            return (
              <div
                className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 md:grid-cols-[1fr_130px_150px_130px_1fr]"
                key={payment.id}
              >
                <div>
                  <p className="font-semibold text-slate-100">{lineup.display_name}</p>
                  <p className="text-xs text-slate-500">
                    Corresponde {formatCurrencyCents(payment.expected_cents)}
                  </p>
                </div>
                <Badge className={getPaymentStatusClass(status)}>
                  {getPaymentStatusLabel(status)}
                </Badge>
                <Select defaultValue={status} name={`paymentStatus:${payment.id}`}>
                  <option value="unpaid">No pago</option>
                  <option value="paid">Pago completo</option>
                  <option value="partial">Pago parcial</option>
                </Select>
                <Input
                  min={0}
                  name={`paidAmount:${payment.id}`}
                  placeholder="$"
                  step="0.01"
                  type="number"
                  defaultValue={formatCentsInputValue(payment.paid_cents)}
                />
                <Input
                  defaultValue={payment.notes ?? ""}
                  name={`paymentNotes:${payment.id}`}
                  placeholder="Nota"
                />
              </div>
            );
          })}
        </div>
        <Button type="submit" variant="secondary">
          Guardar pagos
        </Button>
      </form>
    </details>
  );
}

function MatchesTab({
  clubId,
  competitions,
  financialSummary,
  lineups,
  matches,
  payments,
  players,
  teamPlayers,
  teams
}: {
  clubId: string;
  competitions: ClubCompetitionRecord[];
  financialSummary: ClubFinancialSummary;
  lineups: ClubLineupRecord[];
  matches: ClubMatchRecord[];
  payments: ClubMatchPaymentRecord[];
  players: ClubPlayerRecord[];
  teamPlayers: ClubTeamPlayerRecord[];
  teams: ClubTeamRecord[];
}) {
  const activeTeams = teams.filter((team) => team.active);
  const activeCompetitions = competitions.filter((competition) => competition.active);
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));
  const financeByMatchId = new Map(financialSummary.matches.map((row) => [row.matchId, row]));
  const defaultPlayedDate = getCurrentMatchDateInput();

  return (
    <div className="space-y-4">
      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Nuevo partido jugado</CardTitle>
            <CardDescription className="mt-1">
              Carga resultado, jugadores, invitados y estadisticas del partido.
            </CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white">
            Agregar partido
          </span>
        </summary>
        <form action={addClubMatchAction.bind(null, clubId)} className="mt-4 space-y-5">
          <section className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Torneo</label>
              <Select name="competitionId" required>
                <option value="">Donde se jugo</option>
                {activeCompetitions.map((competition) => (
                  <option key={competition.id} value={competition.id}>
                    {competition.name}
                  </option>
                ))}
              </Select>
            </div>
            <MatchDateTimeFields
              dateName="playedDate"
              defaultDate={defaultPlayedDate}
              requiredTime
              timeName="playedTime"
            />
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Rival</label>
              <Input name="opponentName" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Lugar / cancha</label>
              <Input name="venue" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Costo cancha</label>
              <Input min={0} name="fieldCostAmount" placeholder="0" step="0.01" type="number" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Goles a favor</label>
              <Input min={0} name="goalsFor" required type="number" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200">Goles en contra</label>
              <Input min={0} name="goalsAgainst" required type="number" />
            </div>
          </section>

          <MatchPlayerPicker players={players} teamPlayers={teamPlayers} teams={activeTeams} />

          <MatchGuestFields />

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Notas</label>
            <Textarea name="notes" rows={3} />
          </div>

          <Button type="submit">Guardar partido</Button>
        </form>
      </details>

      <details className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div>
            <CardTitle>Partidos cargados</CardTitle>
            <CardDescription className="mt-1">
              Revisa los partidos existentes antes de hacer cambios.
            </CardDescription>
          </div>
          <span className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200">
            Editar partidos
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          {matches.length ? (
            matches.map((match) => {
              const finance = financeByMatchId.get(match.id);

              return (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={match.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-100">
                        {getTeamName(match.club_team_id, teams)} vs {match.opponent_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatDateTime(match.played_at)} - {formatMatchModality(match.modality)}{match.venue ? ` - ${match.venue}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        {match.club_competition_id ? competitionById.get(match.club_competition_id)?.name ?? "Torneo" : "Sin torneo"}
                      </p>
                    </div>
                    <p className="text-2xl font-black text-white">
                      {match.goals_for} - {match.goals_against}
                    </p>
                  </div>
                  {finance ? (
                    <div className="mt-3 grid gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300 md:grid-cols-4">
                      <p>Cancha: <span className="font-semibold text-slate-100">{formatCurrencyCents(finance.costCents, match.field_cost_currency)}</span></p>
                      <p>Cobrado: <span className="font-semibold text-emerald-200">{formatCurrencyCents(finance.paidCents, match.field_cost_currency)}</span></p>
                      <p>Pendiente: <span className="font-semibold text-amber-200">{formatCurrencyCents(finance.pendingCents, match.field_cost_currency)}</span></p>
                      <p>Jugadores: <span className="font-semibold text-slate-100">{finance.participantCount}</span></p>
                    </div>
                  ) : null}
                  <MatchFinanceEditor
                    clubId={clubId}
                    lineups={lineups}
                    match={match}
                    payments={payments}
                    returnTab="matches"
                  />
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-400">Todavia no hay partidos cargados.</p>
          )}
        </div>
      </details>
    </div>
  );
}

function FinancesTab({
  clubId,
  details
}: {
  clubId: string;
  details: NonNullable<Awaited<ReturnType<typeof getAdminClubDetails>>>;
}) {
  const summary = details.financialSummary;
  const matchesById = new Map(details.matches.map((match) => [match.id, match]));

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardDescription>Cancha total</CardDescription>
          <CardTitle className="mt-1 text-3xl">{formatCurrencyCents(summary.totals.totalCostCents)}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Esperado</CardDescription>
          <CardTitle className="mt-1 text-3xl">{formatCurrencyCents(summary.totals.expectedCents)}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Cobrado</CardDescription>
          <CardTitle className="mt-1 text-3xl">{formatCurrencyCents(summary.totals.paidCents)}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Pendiente</CardDescription>
          <CardTitle className="mt-1 text-3xl">{formatCurrencyCents(summary.totals.pendingCents)}</CardTitle>
        </Card>
      </section>

      <Card>
        <CardTitle>Deuda por jugador</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <TH>Jugador</TH>
                <TH>Partidos</TH>
                <TH>Esperado</TH>
                <TH>Cobrado</TH>
                <TH>Pendiente</TH>
                <TH>Estado</TH>
              </tr>
            </THead>
            <TBody>
              {summary.players.map((player) => (
                <tr key={player.key}>
                  <TD className="font-semibold">{player.displayName}</TD>
                  <TD>{player.matchCount}</TD>
                  <TD>{formatCurrencyCents(player.expectedCents)}</TD>
                  <TD>{formatCurrencyCents(player.paidCents)}</TD>
                  <TD className="font-semibold text-amber-200">{formatCurrencyCents(player.pendingCents)}</TD>
                  <TD>
                    <Badge className={getPaymentStatusClass(player.status)}>
                      {getPaymentStatusLabel(player.status)}
                    </Badge>
                  </TD>
                </tr>
              ))}
              {!summary.players.length ? (
                <tr>
                  <TD className="text-slate-400" colSpan={6}>Todavia no hay pagos de cancha cargados.</TD>
                </tr>
              ) : null}
            </TBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Partidos y cancha</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <THead>
              <tr>
                <TH>Partido</TH>
                <TH>Fecha</TH>
                <TH>Participantes</TH>
                <TH>Costo</TH>
                <TH>Cobrado</TH>
                <TH>Pendiente</TH>
                <TH>Estado</TH>
              </tr>
            </THead>
            <TBody>
              {summary.matches.map((match) => (
                <tr key={match.matchId}>
                  <TD className="font-semibold">{match.opponentName}</TD>
                  <TD>{formatDateTime(match.playedAt)}</TD>
                  <TD>{match.participantCount}</TD>
                  <TD>{formatCurrencyCents(match.costCents)}</TD>
                  <TD>{formatCurrencyCents(match.paidCents)}</TD>
                  <TD className="font-semibold text-amber-200">{formatCurrencyCents(match.pendingCents)}</TD>
                  <TD>
                    <Badge className={getPaymentStatusClass(match.status)}>
                      {getPaymentStatusLabel(match.status)}
                    </Badge>
                  </TD>
                </tr>
              ))}
              {!summary.matches.length ? (
                <tr>
                  <TD className="text-slate-400" colSpan={7}>Todavia no hay costos de cancha cargados.</TD>
                </tr>
              ) : null}
            </TBody>
          </Table>
        </div>
      </Card>

      <Card>
        <CardTitle>Editar pagos</CardTitle>
        <div className="mt-4 space-y-3">
          {summary.matches.map((matchRow) => {
            const match = matchesById.get(matchRow.matchId);
            if (!match) return null;

            return (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={match.id}>
                <p className="font-semibold text-slate-100">
                  {formatDateTime(match.played_at)} - {getTeamName(match.club_team_id, details.teams)} vs {match.opponent_name}
                </p>
                <MatchFinanceEditor
                  clubId={clubId}
                  lineups={details.lineups}
                  match={match}
                  payments={details.payments}
                  returnTab="finances"
                />
              </div>
            );
          })}
          {!summary.matches.length ? (
            <p className="text-sm text-slate-400">Cuando cargues un partido con costo de cancha, vas a poder editar los pagos desde aca.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function ProductEditor({
  clubId,
  product
}: {
  clubId: string;
  product: ClubProductRecord;
}) {
  const imageUrl = getClubProductImageUrl(product);

  return (
    <details className="group rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <summary className="flex cursor-pointer list-none flex-col gap-4 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-4">
          <div className="h-28 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-white">
            {imageUrl ? (
              <img alt={product.name} className="h-full w-full object-contain" src={imageUrl} />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-semibold text-slate-500">
                Sin imagen
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{product.name}</p>
            <p className="mt-1 text-xs text-slate-500">
              {product.category ?? "Sin categoria"} - {getProductStatusLabel(product.status)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge className={getProductStatusClass(product.status)}>
                {getProductStatusLabel(product.status)}
              </Badge>
              <Badge className={product.visible && product.status !== "hidden" ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-700 text-slate-300"}>
                {product.visible && product.status !== "hidden" ? "Visible" : "Oculto"}
              </Badge>
            </div>
          </div>
        </div>
        <span className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-200 transition group-open:border-emerald-400/60 group-open:text-emerald-300">
          Editar producto
        </span>
      </summary>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <form action={updateClubProductAction.bind(null, clubId)} className="grid gap-3 md:grid-cols-12 md:items-start">
          <input name="productId" type="hidden" value={product.id} />
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-name-${product.id}`}>
              Nombre
            </label>
            <Input defaultValue={product.name} id={`product-name-${product.id}`} name="name" required />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-category-${product.id}`}>
              Categoria
            </label>
            <Input defaultValue={product.category ?? ""} id={`product-category-${product.id}`} name="category" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-price-${product.id}`}>
              Precio
            </label>
            <Input defaultValue={product.price_label ?? ""} id={`product-price-${product.id}`} name="priceLabel" placeholder="Consultar precio" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-status-${product.id}`}>
              Estado
            </label>
            <Select defaultValue={product.status} id={`product-status-${product.id}`} name="status">
              {CLUB_PRODUCT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-order-${product.id}`}>
              Orden en catalogo
            </label>
            <Input defaultValue={product.sort_order} id={`product-order-${product.id}`} min={0} name="sortOrder" type="number" />
            <p className="mt-1 text-xs text-slate-500">Menor numero aparece primero.</p>
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-description-${product.id}`}>
              Descripcion publica
            </label>
            <Textarea defaultValue={product.description ?? ""} id={`product-description-${product.id}`} name="description" rows={3} />
            <p className="mt-1 text-xs text-slate-500">Texto visible en la ficha del producto.</p>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-contact-${product.id}`}>
              Contacto
            </label>
            <Select defaultValue={product.contact_channel} id={`product-contact-${product.id}`} name="contactChannel">
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="custom">Link custom</option>
            </Select>
          </div>
          <div className="md:col-span-4">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-contact-url-${product.id}`}>
              Link de contacto propio
            </label>
            <Input defaultValue={product.contact_url ?? ""} id={`product-contact-url-${product.id}`} name="contactUrl" placeholder="Opcional" />
          </div>
          <div className="md:col-span-6">
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={`product-message-${product.id}`}>
              Mensaje de consulta
            </label>
            <Input defaultValue={product.contact_message ?? ""} id={`product-message-${product.id}`} name="contactMessage" placeholder="Opcional: mensaje prearmado para WhatsApp" />
            <p className="mt-1 text-xs text-slate-500">No se muestra en la ficha; se usa al abrir el canal de contacto.</p>
          </div>
          <label className="inline-flex h-11 w-fit items-center gap-2 self-start rounded-md border border-slate-800 bg-slate-900 px-3 text-sm font-semibold text-slate-200 md:col-span-2 md:self-end">
            <input defaultChecked={product.visible} name="visible" type="checkbox" />
            Visible
          </label>
          <div className="md:col-span-4 md:self-end">
            <Button className="h-11" type="submit" variant="secondary">Guardar cambios</Button>
          </div>
        </form>

        <div className="mt-4 grid gap-3 border-t border-slate-800 pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <form action={uploadClubProductImageAction.bind(null, clubId)} className="grid gap-2 sm:grid-cols-[minmax(0,24rem)_auto] sm:items-start">
            <input name="productId" type="hidden" value={product.id} />
            <OptimizedClubSiteImageInput
              className="max-w-md"
              helperText={`JPG, PNG o WEBP hasta ${MAX_CLUB_PRODUCT_IMAGE_SIZE_MB} MB. Se optimiza antes de subir.`}
              maxSourceSizeMb={MAX_CLUB_PRODUCT_IMAGE_SIZE_MB}
              name="productImage"
              variant="product"
            />
            <Button className="h-11 w-fit" type="submit" variant="ghost">Subir imagen</Button>
          </form>
          <form action={deleteClubProductAction.bind(null, clubId)} className="flex lg:justify-end">
            <input name="productId" type="hidden" value={product.id} />
            <ConfirmSubmitButton
              className="h-11 w-fit"
              confirmMessage={`Seguro que quieres eliminar ${product.name}?`}
              label="Eliminar"
            />
          </form>
        </div>
      </div>
    </details>
  );
}

function SiteTab({
  clubId,
  details,
  productFilters,
  productPanel
}: {
  clubId: string;
  details: NonNullable<Awaited<ReturnType<typeof getAdminClubDetails>>>;
  productFilters: SiteProductFilters;
  productPanel: SiteProductPanel;
}) {
  const settings = details.siteSettings;
  const publicHref = buildClubSitePublicHref(details.club, settings);
  const heroUrl = getClubSiteHeroUrl(clubId, settings);
  const productCategories = Array.from(
    new Set(details.products.map((product) => product.category).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right, "es"));
  const filteredProducts = details.products.filter((product) => productMatchesSiteFilters(product, productFilters));
  const activeProductFilters = Boolean(productFilters.search.trim() || productFilters.category || productFilters.status !== "all");

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>Sitio del club</CardTitle>
            <CardDescription className="mt-2">
              Configura identidad, contacto, secciones visibles y catalogo. El sitio se publica solo si esta habilitado y publicado.
            </CardDescription>
          </div>
          <a className={adminContextPrimaryActionLinkClass} href={publicHref}>
            Vista del sitio
          </a>
        </div>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardTitle>Foto principal</CardTitle>
          <CardDescription className="mt-2">
            Esta imagen se usa como cara publica del club. JPG, PNG o WEBP hasta {MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB} MB.
          </CardDescription>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
            <img alt={`Foto principal de ${details.club.name}`} className="aspect-[16/9] w-full object-cover" src={heroUrl} />
          </div>
          <form action={uploadClubSiteHeroAction.bind(null, clubId)} className="mt-4 flex flex-col gap-2">
            <OptimizedClubSiteImageInput
              helperText={`JPG, PNG o WEBP hasta ${MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB} MB. Se prepara en alta calidad antes de subir.`}
              maxSourceSizeMb={MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB}
              name="hero"
              variant="hero"
            />
            <Button className="w-fit" type="submit" variant="secondary">
              Subir foto principal
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Identidad y publicacion</CardTitle>
          <form action={updateClubSiteSettingsAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <input className="mt-1" defaultChecked={settings.enabled} name="enabled" type="checkbox" />
              <span>
                <span className="block font-semibold">Sitio habilitado</span>
                <span className="mt-1 block text-xs text-slate-500">Switch general del sitio del club.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200">
              <input className="mt-1" defaultChecked={settings.published} name="published" type="checkbox" />
              <span>
                <span className="block font-semibold">Publicado</span>
                <span className="mt-1 block text-xs text-slate-500">Permite mostrarlo hacia afuera.</span>
              </span>
            </label>
            <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100 md:col-span-3">
              Tiene que estar habilitado y publicado para verse en la URL publica y en el listado de clubes.
            </p>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="fontFamily">
                Fuente
              </label>
              <Select defaultValue={settings.fontFamily} id="fontFamily" name="fontFamily">
                <option value="system">Sistema</option>
                <option value="inter">Inter</option>
                <option value="montserrat">Montserrat</option>
                <option value="oswald">Oswald</option>
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="domain">
                Dominio propio
              </label>
              <Input defaultValue={settings.domain ?? ""} id="domain" name="domain" placeholder="laquinta.com.ar" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="primaryColor">
                Color primario
              </label>
              <Input className="h-11 p-1" defaultValue={settings.primaryColor} id="primaryColor" name="primaryColor" type="color" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="secondaryColor">
                Color secundario
              </label>
              <Input className="h-11 p-1" defaultValue={settings.secondaryColor} id="secondaryColor" name="secondaryColor" type="color" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="accentColor">
                Color contacto
              </label>
              <Input className="h-11 p-1" defaultValue={settings.accentColor} id="accentColor" name="accentColor" type="color" />
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="whatsappUrlOrPhone">
                WhatsApp
              </label>
              <Input defaultValue={settings.whatsappUrlOrPhone ?? ""} id="whatsappUrlOrPhone" name="whatsappUrlOrPhone" placeholder="54911..." />
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="instagramUrl">
                Instagram
              </label>
              <Input defaultValue={settings.instagramUrl ?? ""} id="instagramUrl" name="instagramUrl" placeholder="https://instagram.com/club" />
            </div>
            <div className="md:col-span-3">
              <p className="text-sm font-semibold text-slate-200">Secciones visibles</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {CLUB_SITE_SECTION_KEYS.map((key) => (
                  <label className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200" key={key}>
                    <input defaultChecked={settings.sectionVisibility[key]} name={`section:${key}`} type="checkbox" />
                    {CLUB_SITE_SECTION_LABELS[key]}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-3">
              <Button type="submit">Guardar sitio</Button>
            </div>
          </form>
        </Card>
      </section>

      <Card>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Catalogo del sitio</CardTitle>
            <CardDescription className="mt-2">
              Crea productos solo cuando los necesites y revisa lo cargado con filtros.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className={productPanel === "new" ? adminContextPrimaryActionLinkClass : adminContextActionLinkClass}
              href={buildSiteProductPath({ clubId, panel: "new" })}
            >
              Cargar nuevo producto
            </Link>
            <Link
              className={productPanel === "products" ? adminContextPrimaryActionLinkClass : adminContextActionLinkClass}
              href={buildSiteProductPath({ clubId, filters: productFilters, panel: "products" })}
            >
              Ver productos actuales
            </Link>
          </div>
        </div>
      </Card>

      {productPanel === "new" ? (
        <Card>
          <CardTitle>Nuevo producto</CardTitle>
          <CardDescription className="mt-2">
            El catalogo no vende directo: cada producto deriva a WhatsApp, Instagram o un link custom.
          </CardDescription>
          <form action={addClubProductAction.bind(null, clubId)} className="mt-4 grid gap-3 md:grid-cols-12 md:items-start">
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-name">
                Nombre
              </label>
              <Input id="new-product-name" name="name" required />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-category">
                Categoria
              </label>
              <Input id="new-product-category" name="category" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-price">
                Precio
              </label>
              <Input id="new-product-price" name="priceLabel" placeholder="Consultar precio" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-status">
                Estado
              </label>
              <Select defaultValue="available" id="new-product-status" name="status">
                {CLUB_PRODUCT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-order">
                Orden en catalogo
              </label>
              <Input defaultValue={details.products.length + 1} id="new-product-order" min={0} name="sortOrder" type="number" />
              <p className="mt-1 text-xs text-slate-500">Menor numero aparece primero.</p>
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-description">
                Descripcion publica
              </label>
              <Textarea id="new-product-description" name="description" rows={3} />
              <p className="mt-1 text-xs text-slate-500">Texto visible en la ficha del producto.</p>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-contact">
                Contacto
              </label>
              <Select defaultValue="whatsapp" id="new-product-contact" name="contactChannel">
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="custom">Link custom</option>
              </Select>
            </div>
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-contact-url">
                Link de contacto propio
              </label>
              <Input id="new-product-contact-url" name="contactUrl" placeholder="Opcional" />
            </div>
            <div className="md:col-span-6">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-message">
                Mensaje de consulta
              </label>
              <Input id="new-product-message" name="contactMessage" placeholder="Opcional: mensaje prearmado para WhatsApp" />
              <p className="mt-1 text-xs text-slate-500">No se muestra en la ficha; se usa al abrir el canal de contacto.</p>
            </div>
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="new-product-image">
                Imagen del producto
              </label>
              <OptimizedClubSiteImageInput
                helperText={`Opcional. JPG, PNG o WEBP hasta ${MAX_CLUB_PRODUCT_IMAGE_SIZE_MB} MB. Se optimiza antes de subir.`}
                id="new-product-image"
                maxSourceSizeMb={MAX_CLUB_PRODUCT_IMAGE_SIZE_MB}
                name="productImage"
                variant="product"
              />
            </div>
            <label className="inline-flex h-11 w-fit items-center gap-2 self-start rounded-md border border-slate-800 bg-slate-950 px-3 text-sm font-semibold text-slate-200 md:col-span-2 md:self-end">
              <input defaultChecked name="visible" type="checkbox" />
              Visible
            </label>
            <div className="md:col-span-6 md:self-end">
              <Button className="h-11" type="submit">Crear producto</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {productPanel === "products" ? (
        <Card>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle>Productos cargados</CardTitle>
              <CardDescription className="mt-2">
                {filteredProducts.length} de {details.products.length} productos encontrados con los filtros actuales.
              </CardDescription>
            </div>
          </div>

          <form action={`/admin/clubs/${clubId}`} className="mt-4 grid gap-3 md:grid-cols-12 md:items-end">
            <input name="tab" type="hidden" value="site" />
            <input name="sitePanel" type="hidden" value="products" />
            <div className="md:col-span-4">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="productSearch">
                Buscar
              </label>
              <Input defaultValue={productFilters.search} id="productSearch" name="productSearch" placeholder="Nombre, categoria o descripcion" />
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="productCategory">
                Categoria
              </label>
              <Select defaultValue={productFilters.category} id="productCategory" name="productCategory">
                <option value="">Todas</option>
                {productCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="productStatus">
                Estado
              </label>
              <Select defaultValue={productFilters.status} id="productStatus" name="productStatus">
                <option value="all">Todos</option>
                {CLUB_PRODUCT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button className="h-11" type="submit" variant="secondary">Filtrar</Button>
              {activeProductFilters ? (
                <Link className={adminContextActionLinkClass} href={buildSiteProductPath({ clubId, panel: "products" })}>
                  Limpiar
                </Link>
              ) : null}
            </div>
          </form>

          <div className="mt-4 space-y-4">
            {filteredProducts.map((product) => (
              <ProductEditor clubId={clubId} key={product.id} product={product} />
            ))}
            {!details.products.length ? (
              <p className="text-sm text-slate-400">Todavia no hay productos. Crea el primero para poblar el catalogo.</p>
            ) : null}
            {details.products.length && !filteredProducts.length ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
                No hay productos que coincidan con esos filtros.
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function AdminsTab({
  clubId,
  details
}: {
  clubId: string;
  details: NonNullable<Awaited<ReturnType<typeof getAdminClubDetails>>>;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Equipo administrador</CardTitle>
        <CardDescription className="mt-2">Puedes sumar hasta 4 administradores por club.</CardDescription>
        <form action={inviteClubAdminAction.bind(null, clubId)} className="mt-4 flex flex-col gap-3 md:flex-row">
          <Input name="email" placeholder="email@dominio.com" required type="email" />
          <Button type="submit" variant="secondary">
            Invitar admin
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Admins activos</CardTitle>
        <div className="mt-4 space-y-3">
          {details.admins.map((admin) => (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center sm:justify-between" key={admin.membershipId}>
              <div>
                <p className="font-semibold text-slate-100">{admin.displayName}</p>
                <p className="mt-1 text-sm text-slate-400">{admin.email ?? "Email no disponible"}</p>
              </div>
              <form action={removeClubAdminAction.bind(null, clubId)}>
                <input name="adminId" type="hidden" value={admin.id} />
                <ConfirmSubmitButton
                  className="h-8 px-3 text-xs"
                  confirmMessage={`Seguro que quieres quitar a ${admin.displayName}?`}
                  label="Quitar"
                  variant="ghost"
                />
              </form>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Invitaciones pendientes</CardTitle>
        <div className="mt-4 space-y-3">
          {details.pendingInvites.length ? (
            details.pendingInvites.map((invite) => (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={invite.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-100">{invite.email}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">{buildAdminInviteUrl(invite.inviteToken)}</p>
                  </div>
                  <form action={revokeClubAdminInviteAction.bind(null, clubId)}>
                    <input name="inviteId" type="hidden" value={invite.id} />
                    <Button type="submit" variant="ghost">
                      Cancelar
                    </Button>
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No hay invitaciones pendientes.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

export default async function AdminClubDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<{
    availablePosition?: string;
    availableSearch?: string;
    callupId?: string;
    callupPosition?: string;
    callupSearch?: string;
    callupSort?: string;
    callupSource?: string;
    error?: string;
    position?: string;
    productCategory?: string;
    productSearch?: string;
    productStatus?: string;
    rosterPosition?: string;
    rosterSearch?: string;
    sitePanel?: string;
    success?: string;
    tab?: string;
    teamId?: string;
    view?: string;
  }>;
}) {
  const [{ clubId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const { admin } = await requireAdminClub(clubId);
  const details = await getAdminClubDetails(clubId);

  if (!details) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "summary";
  const selectedPosition = normalizeClubPlayerPosition(resolvedSearchParams.position);
  const selectedPlayersView = normalizeClubPlayersView(resolvedSearchParams.view);
  const selectedTeam = selectedTab === "teams" && resolvedSearchParams.teamId
    ? details.teams.find((team) => team.id === resolvedSearchParams.teamId)
    : null;
  if (selectedTab === "teams" && resolvedSearchParams.teamId && !selectedTeam) notFound();
  const teamRosterFilters: TeamRosterFilters = {
    availablePosition: normalizeClubPlayerPosition(resolvedSearchParams.availablePosition),
    availableSearch: resolvedSearchParams.availableSearch ?? "",
    rosterPosition: normalizeClubPlayerPosition(resolvedSearchParams.rosterPosition),
    rosterSearch: resolvedSearchParams.rosterSearch ?? ""
  };
  const callupFilters: CallupFilters = {
    position: normalizeClubPlayerPosition(resolvedSearchParams.callupPosition),
    search: resolvedSearchParams.callupSearch ?? "",
    sort: normalizeCallupSortMode(resolvedSearchParams.callupSort),
    source: normalizeCallupSourceFilter(resolvedSearchParams.callupSource)
  };
  const siteProductPanel = normalizeSiteProductPanel(resolvedSearchParams.sitePanel);
  const siteProductFilters: SiteProductFilters = {
    category: resolvedSearchParams.productCategory ?? "",
    search: resolvedSearchParams.productSearch ?? "",
    status: normalizeSiteProductStatusFilter(resolvedSearchParams.productStatus)
  };
  const tabs = [
    { key: "summary", label: "Resumen" },
    { key: "site", label: "Sitio" },
    { key: "players", label: "Jugadores" },
    { key: "teams", label: "Equipos" },
    { key: "competitions", label: "Torneos" },
    { key: "callups", label: "Convocatoria" },
    { key: "matches", label: "Partidos" },
    { key: "finances", label: "Finanzas" },
    { key: "admins", label: "Admins" }
  ];
  const clubSitePublicHref = buildClubSitePublicHref(details.club, details.siteSettings);

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
              <CardTitle>{details.club.name}</CardTitle>
              <CardDescription className="mt-2">
                Gestion privada del club para admins autorizados.
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
            <a className={adminContextPrimaryActionLinkClass} href={clubSitePublicHref}>
              Vista del club
            </a>
          </div>
        </div>
      </Card>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/75 px-4 py-3">
        <nav className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <TabLink active={selectedTab === tab.key} href={`/admin/clubs/${clubId}?tab=${tab.key}`} key={tab.key}>
              {tab.label}
            </TabLink>
          ))}
        </nav>
      </section>

      <Feedback error={resolvedSearchParams.error} success={resolvedSearchParams.success} />

      {selectedTab === "summary" ? <SummaryTab clubId={clubId} details={details} /> : null}
      {selectedTab === "site" ? (
        <SiteTab
          clubId={clubId}
          details={details}
          productFilters={siteProductFilters}
          productPanel={siteProductPanel}
        />
      ) : null}
      {selectedTab === "players" ? (
        <PlayersTab
          clubId={clubId}
          playerView={selectedPlayersView}
          players={details.players}
          selectedPosition={selectedPosition}
        />
      ) : null}
      {selectedTab === "teams" && selectedTeam ? (
        <TeamRosterTab
          clubId={clubId}
          filters={teamRosterFilters}
          players={details.players}
          team={selectedTeam}
          teamPlayers={details.teamPlayers}
        />
      ) : null}
      {selectedTab === "teams" && !selectedTeam ? (
        <TeamsTab clubId={clubId} players={details.players} teamPlayers={details.teamPlayers} teams={details.teams} />
      ) : null}
      {selectedTab === "competitions" ? (
        <CompetitionsTab clubId={clubId} competitions={details.competitions} />
      ) : null}
      {selectedTab === "callups" ? (
        <CallupsTab
          clubId={clubId}
          details={details}
          filters={callupFilters}
          selectedCallupId={resolvedSearchParams.callupId ?? null}
        />
      ) : null}
      {selectedTab === "matches" ? (
        <MatchesTab
          clubId={clubId}
          competitions={details.competitions}
          financialSummary={details.financialSummary}
          lineups={details.lineups}
          matches={details.matches}
          payments={details.payments}
          players={details.players}
          teamPlayers={details.teamPlayers}
          teams={details.teams}
        />
      ) : null}
      {selectedTab === "finances" ? <FinancesTab clubId={clubId} details={details} /> : null}
      {selectedTab === "admins" ? <AdminsTab clubId={clubId} details={details} /> : null}
    </div>
  );
}
