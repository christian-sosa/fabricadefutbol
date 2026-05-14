import { describe, expect, it } from "vitest";

import { metadata } from "@/app/layout";

describe("site metadata", () => {
  it("declara canonical self-referential para evitar señales mixtas de indexacion", () => {
    expect(metadata.alternates).toMatchObject({
      canonical: "./"
    });
  });
});
