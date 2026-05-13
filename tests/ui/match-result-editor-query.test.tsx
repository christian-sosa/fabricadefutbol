import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mutateAsyncMock, routerPushMock } = vi.hoisted(() => ({
  mutateAsyncMock: vi.fn(),
  routerPushMock: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock
  })
}));

vi.mock("@/lib/query/hooks", () => ({
  useUpdateMatchResultMutation: () => ({
    mutateAsync: mutateAsyncMock
  })
}));

import { MatchResultEditorQuery } from "@/components/admin/match-result-editor-query";

describe("MatchResultEditorQuery", () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    routerPushMock.mockReset();
    mutateAsyncMock.mockResolvedValue({ success: true });
  });

  it("redirige al listado de partidos despues de guardar el resultado", async () => {
    const user = userEvent.setup();
    const successRedirectHref = "/admin/matches?view=edit&org=la-banda&success=Resultado%20guardado.";

    render(
      <MatchResultEditorQuery
        defaultNotes=""
        defaultScoreA={3}
        defaultScoreB={2}
        existingParticipants={[
          {
            participantId: "player:player-1",
            fullName: "Jugador 1",
            rating: 1000,
            source: "player",
            initialTeam: "A"
          },
          {
            participantId: "player:player-2",
            fullName: "Jugador 2",
            rating: 990,
            source: "player",
            initialTeam: "B"
          }
        ]}
        matchId="match-1"
        organizationId="org-1"
        submitLabel="Guardar resultado y finalizar"
        successRedirectHref={successRedirectHref}
      />
    );

    await user.click(screen.getByRole("button", { name: "Guardar resultado y finalizar" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalled();
      expect(routerPushMock).toHaveBeenCalledWith(successRedirectHref);
    });
  });
});
