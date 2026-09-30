import { describe, expect, it } from "vitest";
import { buildAdminLoginPath, resolveSafeNextPath } from "@/lib/auth/redirects";

describe("authentication next destinations", () => {
  it.each(["/\n/evil.example", "/\r/evil.example", "/\t\\evil.example", "/\\evil.example", "//evil.example", "https://evil.example", "/admin\u0000", "/admin\u007f", "/admin\\players", "/admin/..//evil.example"])("rejects unsafe parser forms %j", (next) => {
    expect(resolveSafeNextPath(next)).toBe("/admin");
    expect(resolveSafeNextPath(next, "/admin/login")).toBe("/admin/login");
    expect(buildAdminLoginPath(next)).toBe("/admin/login");
  });
  it.each(["/admin/players?org=liga%20a#player-1", "/invite/token?return=%2Fadmin", "/admin?next=%2Fadmin%2Fplayers"])("preserves local path, query and hash %s", (next) => {
    expect(resolveSafeNextPath(next)).toBe(next);
    expect(new URL(resolveSafeNextPath(next), "https://site.example").origin).toBe("https://site.example");
  });
  it("normalizes local dot segments without turning them into an authority", () => {
    expect(resolveSafeNextPath("/admin/../invite/token?org=one#accept")).toBe("/invite/token?org=one#accept");
  });
});
