import { describe, expect, it } from "vitest";

import { deleteOrganizationDeep } from "@/lib/domain/organization-workflow";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "org-1";
const OTHER_ORG_ID = "org-2";
const MATCH_ID = "match-1";
const PLAYER_ID = "player-1";
const TEAM_OPTION_ID = "team-option-1";

describe("organization workflow", () => {
  it("borra la organizacion con sus dependencias en orden y conserva datos de otras organizaciones", async () => {
    const fake = createFakeSupabase({
      organizations: [
        { id: ORG_ID, name: "LQ1", slug: "lq1" },
        { id: OTHER_ORG_ID, name: "Otra", slug: "otra" }
      ],
      organization_admins: [
        { id: "org-admin-1", organization_id: ORG_ID, admin_id: "admin-1" },
        { id: "org-admin-2", organization_id: OTHER_ORG_ID, admin_id: "admin-2" }
      ],
      organization_invites: [
        { id: "invite-1", organization_id: ORG_ID, email: "test@example.com", invited_by: "admin-1" }
      ],
      organization_billing_subscriptions: [
        { id: "subscription-1", organization_id: ORG_ID, status: "active" },
        { id: "subscription-2", organization_id: OTHER_ORG_ID, status: "active" }
      ],
      organization_billing_payments: [
        { id: "payment-1", organization_id: ORG_ID, status: "approved", purpose: "organization_subscription" },
        {
          id: "payment-2",
          organization_id: OTHER_ORG_ID,
          status: "approved",
          purpose: "organization_creation",
          created_organization_id: ORG_ID
        }
      ],
      players: [
        { id: PLAYER_ID, organization_id: ORG_ID, full_name: "Jugador 1", initial_rank: 1 },
        { id: "player-2", organization_id: OTHER_ORG_ID, full_name: "Jugador 2", initial_rank: 1 }
      ],
      matches: [
        { id: MATCH_ID, organization_id: ORG_ID, scheduled_at: "2026-04-20T19:00:00.000Z", modality: "5v5" },
        { id: "match-2", organization_id: OTHER_ORG_ID, scheduled_at: "2026-04-20T20:00:00.000Z", modality: "5v5" }
      ],
      match_players: [
        { id: "match-player-1", match_id: MATCH_ID, player_id: PLAYER_ID, team: "A" },
        { id: "match-player-2", match_id: "match-2", player_id: "player-2", team: "A" }
      ],
      match_guests: [
        { id: "guest-1", match_id: MATCH_ID, guest_name: "Invitado 1" },
        { id: "guest-2", match_id: "match-2", guest_name: "Invitado 2" }
      ],
      team_options: [
        { id: TEAM_OPTION_ID, match_id: MATCH_ID, option_number: 1 },
        { id: "team-option-2", match_id: "match-2", option_number: 1 }
      ],
      team_option_players: [
        { id: "team-option-player-1", team_option_id: TEAM_OPTION_ID, player_id: PLAYER_ID, team: "A" },
        { id: "team-option-player-2", team_option_id: "team-option-2", player_id: "player-2", team: "A" }
      ],
      team_option_guests: [
        { id: "team-option-guest-1", team_option_id: TEAM_OPTION_ID, guest_id: "guest-1", team: "A" },
        { id: "team-option-guest-2", team_option_id: "team-option-2", guest_id: "guest-2", team: "A" }
      ],
      match_result: [
        { id: "match-result-1", match_id: MATCH_ID, score_a: 5, score_b: 4 },
        { id: "match-result-2", match_id: "match-2", score_a: 5, score_b: 3 }
      ],
      rating_history: [
        { id: "rating-1", match_id: MATCH_ID, player_id: PLAYER_ID, delta: 10 },
        { id: "rating-2", match_id: "match-2", player_id: "player-2", delta: 5 }
      ],
      match_player_stats: [
        { id: "stats-1", match_id: MATCH_ID, player_id: PLAYER_ID, goals: 2 },
        { id: "stats-2", match_id: "match-2", player_id: "player-2", goals: 1 }
      ]
    });

    await expect(
      deleteOrganizationDeep({
        supabase: fake.client as never,
        organizationId: ORG_ID
      })
    ).resolves.toMatchObject({
      deletedOrganizationId: ORG_ID,
      deletedPlayers: 1,
      deletedMatches: 1,
      deletedTeamOptions: 1
    });

    expect(fake.table("organizations")).toEqual([
      expect.objectContaining({
        id: OTHER_ORG_ID
      })
    ]);
    expect(fake.table("organization_admins")).toEqual([
      expect.objectContaining({
        organization_id: OTHER_ORG_ID
      })
    ]);
    expect(fake.table("organization_invites")).toHaveLength(0);
    expect(fake.table("organization_billing_subscriptions")).toEqual([
      expect.objectContaining({
        organization_id: OTHER_ORG_ID
      })
    ]);
    expect(fake.table("organization_billing_payments")).toEqual([
      expect.objectContaining({
        id: "payment-2",
        organization_id: OTHER_ORG_ID,
        created_organization_id: null
      })
    ]);
    expect(fake.table("players")).toEqual([
      expect.objectContaining({
        organization_id: OTHER_ORG_ID
      })
    ]);
    expect(fake.table("matches")).toEqual([
      expect.objectContaining({
        organization_id: OTHER_ORG_ID
      })
    ]);
    expect(fake.table("match_players")).toEqual([
      expect.objectContaining({
        match_id: "match-2"
      })
    ]);
    expect(fake.table("match_guests")).toEqual([
      expect.objectContaining({
        match_id: "match-2"
      })
    ]);
    expect(fake.table("team_options")).toEqual([
      expect.objectContaining({
        match_id: "match-2"
      })
    ]);
    expect(fake.table("team_option_players")).toEqual([
      expect.objectContaining({
        team_option_id: "team-option-2"
      })
    ]);
    expect(fake.table("team_option_guests")).toEqual([
      expect.objectContaining({
        team_option_id: "team-option-2"
      })
    ]);
    expect(fake.table("match_result")).toEqual([
      expect.objectContaining({
        match_id: "match-2"
      })
    ]);
    expect(fake.table("rating_history")).toEqual([
      expect.objectContaining({
        match_id: "match-2"
      })
    ]);
    expect(fake.table("match_player_stats")).toEqual([
      expect.objectContaining({
        match_id: "match-2"
      })
    ]);
  });
});
