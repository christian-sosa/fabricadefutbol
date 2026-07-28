import { describe, expect, it } from "vitest";

import { getAdminMatchListActions } from "@/lib/admin-match-actions";

describe("getAdminMatchListActions", () => {
  it("distingue la carga inicial de la correccion de un resultado", () => {
    expect(getAdminMatchListActions("confirmed")).toEqual({
      canLoadResult: true,
      canCorrectResult: false
    });
    expect(getAdminMatchListActions("finished")).toEqual({
      canLoadResult: false,
      canCorrectResult: true
    });
    expect(getAdminMatchListActions("draft")).toEqual({
      canLoadResult: false,
      canCorrectResult: false
    });
  });
});
