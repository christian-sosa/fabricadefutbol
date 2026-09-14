import { describe, expect, it } from "vitest";
import { getPastPendingResultMatch } from "@/lib/admin-pending-match";

describe("pending result", () => {
  it("elige el pendiente pasado más antiguo e ignora futuros, borradores y finalizados", () => {
    const matches = [
      { id: "future", status: "confirmed", scheduled_at: "2026-09-15T20:00:00Z" },
      { id: "finished", status: "finished", scheduled_at: "2026-08-01T20:00:00Z" },
      { id: "draft", status: "draft", scheduled_at: "2026-08-02T20:00:00Z" },
      { id: "recent", status: "confirmed", scheduled_at: "2026-09-13T20:00:00Z" },
      { id: "older", status: "confirmed", scheduled_at: "2026-09-06T20:00:00Z" }
    ];
    expect(getPastPendingResultMatch(matches, "2026-09-14T12:00:00Z")?.id).toBe("older");
    expect(getPastPendingResultMatch(matches.slice(0, 3), "2026-09-14T12:00:00Z")).toBeNull();
    expect(matches[0].id).toBe("future");
  });
});
