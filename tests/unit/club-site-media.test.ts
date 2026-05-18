import { describe, expect, it } from "vitest";

import {
  CLUB_SITE_HERO_HEIGHT_PX,
  CLUB_SITE_HERO_QUALITY,
  CLUB_SITE_HERO_WIDTH_PX,
  CLUB_PRODUCT_IMAGE_HEIGHT_PX,
  CLUB_PRODUCT_IMAGE_QUALITY,
  CLUB_PRODUCT_IMAGE_WIDTH_PX,
  MAX_CLUB_PRODUCT_IMAGE_SIZE_MB,
  MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB
} from "@/lib/club-site-media";

describe("club site media", () => {
  it("permite una foto principal premium y mas pesada que las imagenes de producto", () => {
    expect(MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB).toBe(30);
    expect(MAX_CLUB_PRODUCT_IMAGE_SIZE_MB).toBe(10);
    expect(MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB).toBeGreaterThan(MAX_CLUB_PRODUCT_IMAGE_SIZE_MB);
    expect(CLUB_SITE_HERO_WIDTH_PX).toBe(2400);
    expect(CLUB_SITE_HERO_HEIGHT_PX).toBe(1600);
    expect(CLUB_SITE_HERO_QUALITY).toBe(92);
  });

  it("preserva silueta vertical para productos de catalogo", () => {
    expect(CLUB_PRODUCT_IMAGE_WIDTH_PX).toBe(1200);
    expect(CLUB_PRODUCT_IMAGE_HEIGHT_PX).toBe(1500);
    expect(CLUB_PRODUCT_IMAGE_QUALITY).toBe(90);
  });
});
