import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSupabase } from "../helpers/fake-supabase";

const mocks = vi.hoisted(() => ({ client: vi.fn(), details: vi.fn(), form: vi.fn() }));
const organizationId = "11111111-1111-4111-8111-111111111111";
const pastId = "22222222-2222-4222-8222-222222222222";
const futureId = "33333333-3333-4333-8333-333333333333";
vi.mock("@/lib/auth/admin", () => ({
  requireAdminOrganization: async () => ({ admin: {}, selectedOrganization: { id: organizationId, slug: "viernes" } }),
  getOrganizationWriteAccess: async () => ({ canWrite: true })
}));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/lib/queries/admin", () => ({
  getAdminMatchDetails: mocks.details,
  getSelectablePlayers: async () => [{ id: "player-1" }, { id: "player-2" }]
}));
vi.mock("@/components/admin/admin-current-group-card", () => ({ AdminCurrentGroupCard: () => null }));
vi.mock("@/components/admin/new-match-form", () => ({
  NewMatchForm: (props: Record<string, unknown>) => { mocks.form(props); return <div data-testid="match-form" />; }
}));
import NewMatchPage from "@/app/admin/(panel)/matches/new/page";

describe("repetir el último partido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T15:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("elige una fecha pasada del grupo y prepara la próxima semana con convocados vigentes", async () => {
    const db = createFakeSupabase({
      matches: [
        { id: pastId, organization_id: organizationId, status: "finished", scheduled_at: "2026-08-28T21:00:00Z" },
        { id: futureId, organization_id: organizationId, status: "confirmed", scheduled_at: "2026-10-09T21:00:00Z" },
        { id: "44444444-4444-4444-8444-444444444444", organization_id: organizationId, status: "draft", scheduled_at: "2026-09-25T21:00:00Z" },
        { id: "55555555-5555-4555-8555-555555555555", organization_id: "another-group", status: "finished", scheduled_at: "2026-09-29T21:00:00Z" }
      ],
      match_players: [
        { match_id: pastId, player_id: "player-2", is_substitute: true, substitute_team: "B" },
        { match_id: pastId, player_id: "inactive", is_substitute: true, substitute_team: "A" }
      ],
      match_guests: [{ id: "guest-1", match_id: pastId, guest_name: "Invitado", guest_rating: 1100, is_substitute: false, substitute_team: null }]
    });
    mocks.client.mockResolvedValue(db.client);
    mocks.details.mockResolvedValue({
      match: { scheduled_at: "2026-08-28T21:00:00Z", modality: "5v5", location: "Cancha del barrio", goalkeeper_player_ids: ["player-1", "player-2"] },
      options: [{ is_confirmed: true, teamA: [{ id: "player-1", is_guest: false }, { id: "inactive", is_guest: false }], teamB: [{ id: "guest-1", is_guest: true }] }]
    });

    render(await NewMatchPage({ searchParams: Promise.resolve({ org: "viernes", repeat: "last" }) }));

    expect(mocks.details).toHaveBeenCalledWith(pastId, organizationId);
    expect(screen.getByText("Repetir partido")).toBeInTheDocument();
    expect(mocks.form.mock.calls[0][0]).toMatchObject({
      defaultScheduledDate: "2026-10-02",
      requestId: expect.stringMatching(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/),
      initialValues: {
        modality: "5v5", location: "Cancha del barrio", scheduledTime: "21:00",
        playerIds: ["player-1", "player-2"], goalkeeperPlayerIds: ["player-1", "player-2"],
        guests: [{ name: "Invitado", rating: 1100 }],
        substituteAssignments: [{ participantId: "player:player-2", team: "B" }]
      }
    });
  });

  it("permite crear el primer partido cuando todavía no hay una fecha para repetir", async () => {
    mocks.client.mockResolvedValue(createFakeSupabase({ matches: [] }).client);
    render(await NewMatchPage({ searchParams: Promise.resolve({ repeat: "last" }) }));
    expect(screen.getByText("Crear partido")).toBeInTheDocument();
    expect(mocks.details).not.toHaveBeenCalled();
    expect(mocks.form.mock.calls[0][0]).toMatchObject({ defaultScheduledDate: "2026-09-30", initialValues: undefined });
  });
});
