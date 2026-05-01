import { describe, expect, it } from "vitest";

import {
  GROWTH_EVENT_QUERY_PARAM,
  isGrowthEventName,
  withGrowthEvent,
  withShareTracking
} from "@/lib/growth";

describe("growth helpers", () => {
  it("agrega un evento de crecimiento sin perder query params existentes", () => {
    expect(withGrowthEvent("/admin?org=los-pibes", "group_created")).toBe(
      `/admin?org=los-pibes&${GROWTH_EVENT_QUERY_PARAM}=group_created&ff_source=server`
    );
  });

  it("agrega parametros UTM para links compartidos por WhatsApp", () => {
    expect(withShareTracking("/ranking?org=los-pibes", "ranking")).toBe(
      "/ranking?org=los-pibes&utm_source=whatsapp&utm_medium=share&utm_campaign=group_growth&utm_content=ranking"
    );
  });

  it("valida solo eventos conocidos", () => {
    expect(isGrowthEventName("match_created")).toBe(true);
    expect(isGrowthEventName("unknown")).toBe(false);
  });
});
