import { describe, expect, it } from "vitest";

import {
  MAX_CLUB_PRODUCT_IMAGE_SIZE_MB,
  MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB
} from "@/lib/club-site-media";

describe("club site media", () => {
  it("permite una foto principal mas pesada que las imagenes de producto", () => {
    expect(MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB).toBe(25);
    expect(MAX_CLUB_PRODUCT_IMAGE_SIZE_MB).toBe(10);
    expect(MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB).toBeGreaterThan(MAX_CLUB_PRODUCT_IMAGE_SIZE_MB);
  });
});
