import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const clubDetailPath = path.join(root, "src", "app", "admin", "(panel)", "clubs", "[clubId]", "page.tsx");

describe("admin club players UX source", () => {
  it("usa subvistas de acciones para jugadores de club", () => {
    const source = readFileSync(clubDetailPath, "utf8");

    expect(source).toContain('type ClubPlayersView = "new" | "bulk" | "pool";');
    expect(source).toContain('const showCreateForm = playerView === "new";');
    expect(source).toContain('const showBulkForm = playerView === "bulk";');
    expect(source).toContain('const showPool = playerView === "pool";');
    expect(source).toContain('view: "new"');
    expect(source).toContain('view: "bulk"');
    expect(source).toContain('view: "pool"');
    expect(source).toContain("Agregar masivo");
    expect(source).toContain("Ver pool");
    expect(source).toContain("normalizeClubPlayersView(resolvedSearchParams.view)");
  });
});
