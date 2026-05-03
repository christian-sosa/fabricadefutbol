import { describe, expect, it } from "vitest";

import { getAdminMatchListActions } from "@/lib/admin-match-actions";

describe("getAdminMatchListActions", () => {
  it("muestra carga de resultado solo en partidos confirmados", () => {
    expect(getAdminMatchListActions("confirmed")).toEqual({
      canLoadResult: true
    });
    expect(getAdminMatchListActions("finished")).toEqual({
      canLoadResult: false
    });
  });
});
