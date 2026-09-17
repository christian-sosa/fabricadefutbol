import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServerClientMock } = vi.hoisted(() => ({
  createSupabaseServerClientMock: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: createSupabaseServerClientMock
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn() }));

import { getMatchCalendarActivity } from "@/lib/queries/public";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "calendar-group";
const currentSeason = {
  id: "season-current",
  organization_id: ORG_ID,
  label: "2026",
  duration_months: 12,
  starts_at: "2026-01-01",
  ends_at: "2026-12-31",
  status: "active"
};
const previousSeason = {
  ...currentSeason,
  id: "season-previous",
  label: "2025",
  starts_at: "2025-01-01",
  ends_at: "2025-12-31",
  status: "closed"
};

function match(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    organization_id: ORG_ID,
    scheduled_at: "2026-09-01T00:30:00.000Z",
    modality: "5v5",
    status: "finished",
    season_id: currentSeason.id,
    ...overrides
  };
}

describe("getMatchCalendarActivity", () => {
  beforeEach(() => createSupabaseServerClientMock.mockReset());

  it("no consulta datos sin un grupo seleccionado", async () => {
    await expect(getMatchCalendarActivity(null)).resolves.toEqual({ matches: [], season: null });
    expect(createSupabaseServerClientMock).not.toHaveBeenCalled();
  });

  it("incluye solo finalizados del grupo y la temporada elegida y conserva la fecha deportiva", async () => {
    const fake = createFakeSupabase({
      organization_seasons: [currentSeason, previousSeason],
      matches: [
        match("finished-b"),
        match("other-group", { organization_id: "other-group" }),
        match("cancelled", { status: "cancelled" }),
        match("confirmed", { status: "confirmed" }),
        match("draft", { status: "draft" }),
        match("previous", { season_id: previousSeason.id, scheduled_at: "2025-12-01T20:00:00.000Z" }),
        match("finished-a"),
        match("earlier", { scheduled_at: "2026-08-01T20:00:00.000Z" })
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const result = await getMatchCalendarActivity(ORG_ID, currentSeason.id);

    expect(result.matches).toEqual([
      { id: "earlier", scheduledAt: "2026-08-01T20:00:00.000Z", modality: "5v5" },
      { id: "finished-a", scheduledAt: "2026-09-01T00:30:00.000Z", modality: "5v5" },
      { id: "finished-b", scheduledAt: "2026-09-01T00:30:00.000Z", modality: "5v5" }
    ]);
    expect(result.season).toEqual({
      id: currentSeason.id,
      label: "2026",
      durationMonths: 12,
      startsAt: currentSeason.starts_at,
      endsAt: currentSeason.ends_at,
      status: "active"
    });
  });

  it("resuelve la temporada actual del grupo sin tomar una activa de otro grupo", async () => {
    const fake = createFakeSupabase({
      organization_seasons: [
        previousSeason,
        currentSeason,
        { ...currentSeason, id: "foreign-season", organization_id: "other-group", starts_at: "2026-06-01" }
      ],
      matches: [match("current"), match("previous", { season_id: previousSeason.id })]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const result = await getMatchCalendarActivity(ORG_ID);

    expect(result.matches.map((item) => item.id)).toEqual(["current"]);
    expect(result.season?.id).toBe(currentSeason.id);
  });

  it("Todo incluye distintas temporadas y partidos sin temporada del mismo grupo", async () => {
    const fake = createFakeSupabase({
      organization_seasons: [currentSeason, previousSeason],
      matches: [
        match("current"),
        match("previous", { season_id: previousSeason.id }),
        match("unassigned", { season_id: null }),
        match("foreign", { organization_id: "other-group" })
      ]
    });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    const result = await getMatchCalendarActivity(ORG_ID, "all");

    expect(result.matches.map((item) => item.id)).toEqual(["current", "previous", "unassigned"]);
    expect(result.season).toBeNull();
  });

  it("recupera más de 1000 partidos en páginas ordenadas sin duplicar ni truncar", async () => {
    const ids = Array.from({ length: 1205 }, (_, index) => `match-${String(index).padStart(4, "0")}`);
    const fake = createFakeSupabase({ matches: [...ids].reverse().map((id) => match(id)) });
    const ranges: [number, number][] = [];
    const client = {
      ...fake.client,
      from: (...args: Parameters<typeof fake.client.from>) => {
        const query = fake.client.from(...args);
        const originalRange = query.range.bind(query);
        query.range = (from, to) => {
          ranges.push([from, to]);
          return originalRange(from, to);
        };
        return query;
      }
    };
    createSupabaseServerClientMock.mockResolvedValue(client);

    const result = await getMatchCalendarActivity(ORG_ID, "all");

    expect(result.matches.map((item) => item.id)).toEqual(ids);
    expect(ranges).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  });

  it.each([
    ["matches", "all"],
    ["organization_seasons", "current"]
  ] as const)("propaga los errores de %s", async (table, season) => {
    const fake = createFakeSupabase({ queryFailures: { [table]: { select: "Consulta no disponible" } } });
    createSupabaseServerClientMock.mockResolvedValue(fake.client);

    await expect(getMatchCalendarActivity(ORG_ID, season)).rejects.toThrow("Consulta no disponible");
  });
});
