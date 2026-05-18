import { describe, expect, it } from "vitest";

import { hostBelongsToMainApp, isClubSiteStandaloneHost } from "@/lib/club-site-request";

describe("club site host resolution", () => {
  it("detecta dominios propios de club como superficies standalone", () => {
    expect(isClubSiteStandaloneHost("www.laquinta.com.ar")).toBe(true);
    expect(isClubSiteStandaloneHost("laquinta.com.ar:443")).toBe(true);
  });

  it("mantiene hosts de Fabrica y desarrollo dentro del chrome de la plataforma", () => {
    expect(hostBelongsToMainApp("fabricadefutbol.com.ar")).toBe(true);
    expect(isClubSiteStandaloneHost("fabricadefutbol.com.ar")).toBe(false);
    expect(isClubSiteStandaloneHost("localhost:3000")).toBe(false);
    expect(isClubSiteStandaloneHost("")).toBe(false);
  });
});
