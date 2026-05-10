import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MatchPlayerPicker } from "@/app/admin/(panel)/clubs/[clubId]/match-player-picker";

describe("MatchPlayerPicker", () => {
  it("muestra controles de pago de cancha para jugadores del partido", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MatchPlayerPicker
        players={[
          {
            id: "player-1",
            club_id: "club-1",
            full_name: "Sosa",
            nickname: null,
            position: null,
            shirt_number: null,
            photo_path: null,
            active: true
          }
        ]}
        teamPlayers={[
          {
            id: "roster-1",
            club_team_id: "team-1",
            club_player_id: "player-1"
          }
        ]}
        teams={[
          {
            id: "team-1",
            club_id: "club-1",
            name: "La Quinta F5",
            short_name: "LQ5",
            logo_path: null,
            modality: "5v5",
            active: true
          }
        ]}
      />
    );

    const teamSelect = container.querySelector('select[name="teamId"]') as HTMLSelectElement;
    await user.selectOptions(teamSelect, "team-1");

    expect(screen.getByText("Sosa")).toBeInTheDocument();
    expect(container.querySelector('select[name="playerPaymentStatus:player-1"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="playerPaidAmount:player-1"]')).toBeInTheDocument();
  });
});
