import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("admin club site image previews source", () => {
  it("keeps the site tab extracted and uses Next Image for previews", () => {
    const pageSource = readFileSync(
      path.join(root, "src", "app", "admin", "(panel)", "clubs", "[clubId]", "page.tsx"),
      "utf8"
    );
    const siteTabSource = readFileSync(
      path.join(root, "src", "app", "admin", "(panel)", "clubs", "[clubId]", "site-tab.tsx"),
      "utf8"
    );

    expect(pageSource).toContain('from "@/app/admin/(panel)/clubs/[clubId]/site-tab";');
    expect(siteTabSource).toContain('import Image from "next/image";');
    expect(siteTabSource).toContain("export function SiteTab");
    expect(siteTabSource).not.toContain("<img alt={product.name}");
    expect(siteTabSource).not.toContain("<img alt={`Foto principal de ${details.club.name}`");
  });
});
