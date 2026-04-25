import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const schemaSql = readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const policiesSql = readFileSync(path.join(root, "supabase", "policies.sql"), "utf8");

const privateBuckets = [
  "player-photos",
  "player-photos-dev",
  "organization-images",
  "organization-images-dev",
  "league-logos",
  "league-logos-dev",
  "league-photos",
  "league-photos-dev",
  "team-logos",
  "team-logos-dev"
] as const;

describe("storage privacy policies", () => {
  it("mantiene privados los buckets con assets de producto", () => {
    for (const bucket of privateBuckets) {
      expect(schemaSql).toMatch(
        new RegExp(`'${bucket}',\\s*\\n\\s*'${bucket}',\\s*\\n\\s*false,`)
      );
    }
  });

  it("no deja policies de lectura publica por bucket completo", () => {
    expect(policiesSql).not.toContain("using (bucket_id in ('player-photos', 'player-photos-dev'));");
    expect(policiesSql).not.toContain(
      "using (bucket_id in ('organization-images', 'organization-images-dev'));"
    );
    expect(policiesSql).not.toContain("using (bucket_id in ('league-logos', 'league-logos-dev'));");
    expect(policiesSql).not.toContain("using (bucket_id in ('league-photos', 'league-photos-dev'));");
    expect(policiesSql).not.toContain("using (bucket_id in ('team-logos', 'team-logos-dev'));");
  });

  it("ata la lectura de objetos a las reglas de negocio", () => {
    expect(policiesSql).toContain("public.can_read_player_photo_object(name)");
    expect(policiesSql).toContain("public.can_read_organization_image_object(name)");
    expect(policiesSql).toContain("public.can_read_league_logo_object(name)");
    expect(policiesSql).toContain("public.can_read_league_photo_object(name)");
    expect(policiesSql).toContain("public.can_read_team_logo_object(name)");
  });
});
