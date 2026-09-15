import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorize, getDetails, createClient, rpc, from, revalidate } = vi.hoisted(() => ({
  authorize: vi.fn(), getDetails: vi.fn(), createClient: vi.fn(), rpc: vi.fn(),
  from: vi.fn(() => { throw new Error("A formation action must only write through its atomic RPC"); }),
  revalidate: vi.fn()
}));
vi.mock("@/lib/auth/admin", () => ({ assertOrganizationAdminAction: authorize }));
vi.mock("@/lib/queries/admin", () => ({ getAdminMatchDetails: getDetails }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: createClient }));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));

import { saveMatchFormationAction } from "@/app/admin/(panel)/matches/[id]/formation-actions";
import { MATCH_MODALITIES, TEAM_SIZE_BY_MODALITY } from "@/lib/constants";
import { FORMATION_PRESETS, type FormationModality } from "@/lib/domain/match-formation";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const matchId = id(1), organizationId = id(2), optionId = id(3);
function fixture(modality: FormationModality = "9v9") {
  const size = TEAM_SIZE_BY_MODALITY[modality];
  const preset = FORMATION_PRESETS[modality][0];
  const slotIds = ["gk", ...preset.split("-").flatMap((lineSize, line) => Array.from({ length: Number(lineSize) }, (_, position) => `line-${line}-${position}`))];
  const teamA = Array.from({ length: size }, (_, i) => ({ id: id(100 + i), full_name: `Jugador A ${i}`, is_guest: false }));
  const teamB = Array.from({ length: size }, (_, i) => ({ id: i === size - 1 ? `guest-${id(300)}` : id(200 + i), full_name: i === size - 1 ? "Invitado" : `Jugador B ${i}`, is_guest: i === size - 1 }));
  const makeTeam = (players: typeof teamA) => ({ formationId: preset, slots: players.map((player, i) => ({
    slotId: slotIds[i], participantId: player.is_guest ? `guest:${id(300)}` : `player:${player.id}`
  })) });
  const formation = { teamA: makeTeam(teamA), teamB: makeTeam(teamB) };
  const details = {
    match: { id: matchId, organization_id: organizationId, modality: `${size}v${size}`, status: "confirmed", confirmed_option_id: optionId, goalkeeper_player_ids: [id(100), id(200)] },
    options: [{ id: optionId, is_confirmed: true, teamA, teamB }]
  };
  return { details, formation };
}
const call = (payload: unknown = fixture().formation, version = 0) => saveMatchFormationAction(matchId, organizationId, version, JSON.stringify(payload));
const expectNoWrite = () => { expect(createClient).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled(); expect(from).not.toHaveBeenCalled(); expect(revalidate).not.toHaveBeenCalled(); };

describe("formation Server Action boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorize.mockResolvedValue({ userId: id(4) });
    getDetails.mockResolvedValue(fixture().details);
    createClient.mockResolvedValue({ rpc, from });
    rpc.mockResolvedValue({ data: { formation_version: 1 }, error: null });
  });

  it("waits for group authorization before reading the match or obtaining a write client", async () => {
    let allow!: () => void;
    authorize.mockImplementationOnce(() => new Promise<void>((resolve) => { allow = resolve; }));
    const pending = call();
    expect(authorize).toHaveBeenCalledWith(organizationId);
    expect(getDetails).not.toHaveBeenCalled();
    expectNoWrite();
    allow();
    expect(await pending).toEqual({ ok: true, version: 1 });
    expect(getDetails).toHaveBeenCalledWith(matchId, organizationId);
    expect(authorize.mock.invocationCallOrder[0]).toBeLessThan(getDetails.mock.invocationCallOrder[0]);
    expect(getDetails.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
  });

  it("denies an unauthorized group without querying a roster or attempting any mutation", async () => {
    authorize.mockRejectedValueOnce(new Error("No tenés permiso en este grupo."));
    expect(await call()).toEqual({ ok: false, error: "No tenés permiso en este grupo." });
    expect(getDetails).not.toHaveBeenCalled();
    expectNoWrite();
  });

  it("preserves the Next redirect when the authorization layer requires login or MFA", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/admin/login;307;" });
    authorize.mockRejectedValueOnce(redirect);
    await expect(call()).rejects.toBe(redirect);
    expect(getDetails).not.toHaveBeenCalled();
    expectNoWrite();
  });

  it.each([-1, 0.5, NaN, Infinity])("rejects malformed version %s before querying or writing", async (version) => {
    expect(await call(fixture().formation, version)).toMatchObject({ ok: false, error: expect.stringContaining("no es válida") });
    expect(authorize).not.toHaveBeenCalled();
    expect(getDetails).not.toHaveBeenCalled();
    expectNoWrite();
  });

  it("rejects invalid identifiers and oversized serialized payloads before accessing data", async () => {
    for (const [candidateMatchId, candidateOrgId, payload] of [["bad-id", organizationId, "null"], [matchId, "bad-org", "null"], [matchId, organizationId, "x".repeat(6001)]]) {
      expect(await saveMatchFormationAction(candidateMatchId, candidateOrgId, 0, payload)).toMatchObject({ ok: false });
      expect(authorize).not.toHaveBeenCalled();
      expect(getDetails).not.toHaveBeenCalled();
      expectNoWrite();
    }
  });

  it("rejects malformed JSON after authorization without calling the mutation client", async () => {
    expect(await saveMatchFormationAction(matchId, organizationId, 0, "{bad-json")).toMatchObject({ ok: false });
    expect(authorize).toHaveBeenCalledWith(organizationId);
    expectNoWrite();
  });

  it.each(["draft", "finished", "cancelled"])("does not edit a %s match", async (status) => {
    const { details } = fixture(); details.match.status = status;
    getDetails.mockResolvedValueOnce(details);
    expect(await call()).toMatchObject({ ok: false, error: expect.stringContaining("confirmados") });
    expectNoWrite();
  });

  it("requires an existing match and its actual confirmed option", async () => {
    const missingOptions = fixture().details; missingOptions.options = [];
    const wrongOption = fixture().details; wrongOption.match.confirmed_option_id = id(99);
    const unconfirmedOption = fixture().details; unconfirmedOption.options[0].is_confirmed = false;
    for (const details of [null, missingOptions, wrongOption, unconfirmedOption]) {
      getDetails.mockResolvedValueOnce(details);
      expect(await call()).toMatchObject({ ok: false });
      expectNoWrite();
    }
  });

  it.each(MATCH_MODALITIES)("saves both complete %s teams with a guest through exactly one atomic RPC", async (modality) => {
    const { details, formation } = fixture(modality);
    getDetails.mockResolvedValueOnce(details);
    rpc.mockResolvedValueOnce({ data: { formation_version: 8 }, error: null });
    expect(await call(formation, 7)).toEqual({ ok: true, version: 8 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_group_match_formation", {
      p_match_id: matchId, p_organization_id: organizationId, p_expected_version: 7, p_formation: formation
    });
    expect(formation.teamB.slots.at(-1)?.participantId).toBe(`guest:${id(300)}`);
    expect(from).not.toHaveBeenCalled();
    expect(revalidate.mock.calls).toEqual([[`/admin/matches/${matchId}`], [`/matches/${matchId}`], ["/upcoming"]]);
    expect(revalidate.mock.invocationCallOrder[0]).toBeGreaterThan(rpc.mock.invocationCallOrder[0]);
  });

  it("clears the saved formation with null and revalidates its public and admin pages", async () => {
    rpc.mockResolvedValueOnce({ data: { formation_version: 4 }, error: null });
    expect(await call(null, 3)).toEqual({ ok: true, version: 4 });
    expect(rpc).toHaveBeenCalledWith("save_group_match_formation", {
      p_match_id: matchId, p_organization_id: organizationId, p_expected_version: 3, p_formation: null
    });
    expect(from).not.toHaveBeenCalled();
    expect(revalidate).toHaveBeenCalledTimes(3);
  });

  it("rejects an incomplete formation, a duplicate, or a player outside the team's pool", async () => {
    const incomplete = fixture().formation; incomplete.teamA.slots.pop();
    const duplicate = fixture().formation; duplicate.teamA.slots[1].participantId = duplicate.teamA.slots[0].participantId;
    const outside = fixture().formation; outside.teamA.slots[1].participantId = `player:${id(999)}`;
    const opponent = fixture().formation; opponent.teamA.slots[1].participantId = opponent.teamB.slots[1].participantId;
    const guest = fixture().formation; guest.teamB.slots.at(-1)!.participantId = `guest:${id(999)}`;
    for (const value of [{}, [], incomplete, duplicate, outside, opponent, guest]) {
      expect(await call(value)).toMatchObject({ ok: false });
      expectNoWrite();
    }
  });

  it("rejects a mismatched modality, changed roster and moved marked goalkeeper before the RPC", async () => {
    const wrongModality = fixture(); wrongModality.details.match.modality = "7v7";
    const unsupportedModality = fixture(); unsupportedModality.details.match.modality = "8v8";
    const shorterRoster = fixture(); shorterRoster.details.options[0].teamA.pop();
    const movedGoalkeeper = fixture();
    [movedGoalkeeper.formation.teamA.slots[0].participantId, movedGoalkeeper.formation.teamA.slots[1].participantId] = [movedGoalkeeper.formation.teamA.slots[1].participantId, movedGoalkeeper.formation.teamA.slots[0].participantId];
    for (const candidate of [wrongModality, unsupportedModality, shorterRoster, movedGoalkeeper]) {
      getDetails.mockResolvedValueOnce(candidate.details);
      expect(await call(candidate.formation)).toMatchObject({ ok: false });
      expectNoWrite();
    }
  });

  it("returns a conflict from a competing save without retrying or using direct table writes", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "PT409", message: "Stale formation" } });
    expect(await call()).toEqual({ ok: false, conflict: true, error: "Otra sesión cambió la formación o los equipos. Recargá antes de guardar." });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("preserves a database rejection without trying an alternative mutation", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "No autorizado." } });
    expect(await call()).toEqual({ ok: false, conflict: false, error: "No autorizado." });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("handles an uncertain network failure without retrying a possibly committed RPC", async () => {
    rpc.mockRejectedValueOnce(new Error("Se perdió la conexión."));
    expect(await call()).toEqual({ ok: false, error: "Se perdió la conexión." });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("does not write when loading the current match fails and handles an unknown thrown cause", async () => {
    getDetails.mockRejectedValueOnce(new Error("No se pudo cargar el partido."));
    expect(await call()).toEqual({ ok: false, error: "No se pudo cargar el partido." });
    expectNoWrite();
    createClient.mockRejectedValueOnce("offline");
    expect(await call()).toEqual({ ok: false, error: "No se pudo guardar la formación. Volvé a intentar." });
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});
