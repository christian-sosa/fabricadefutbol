import { NextResponse } from "next/server";

import { CLUB_PRODUCT_IMAGE_CACHE_CONTROL } from "@/lib/club-site-media";
import { getClubSiteMediaBucket } from "@/lib/env";
import { canAccessClubsProduct } from "@/lib/features";
import {
  createSignedStorageRedirect,
  createStorageObjectStreamResponse
} from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildProductPlaceholderSvg(productName: string) {
  const safeProductName = productName.replace(/[<>&"]/g, "");
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="${safeProductName}">
  <rect width="1000" height="1000" fill="#101010"/>
  <rect x="76" y="76" width="848" height="848" rx="36" fill="#f7951d"/>
  <rect x="128" y="128" width="744" height="744" rx="28" fill="#151515"/>
  <path d="M260 610 C360 525 470 690 570 585 C670 480 760 560 840 500 L840 872 L260 872 Z" fill="rgba(247,149,29,0.28)"/>
  <text x="500" y="500" fill="#ffffff" font-family="Arial, sans-serif" font-size="64" font-weight="800" text-anchor="middle">${safeProductName}</text>
</svg>`.trim();
}

function buildPlaceholderResponse(productName = "Producto") {
  return new NextResponse(buildProductPlaceholderSvg(productName), {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": CLUB_PRODUCT_IMAGE_CACHE_CONTROL
    }
  });
}

export async function GET(
  _: Request,
  context: {
    params: Promise<{ productId: string }>;
  }
) {
  if (!canAccessClubsProduct()) {
    return new NextResponse(null, { status: 404 });
  }

  const { productId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: product, error } = await supabase
    .from("club_products")
    .select("name, image_path")
    .eq("id", productId)
    .maybeSingle();

  if (error || !product) {
    return buildPlaceholderResponse();
  }

  const objectPath = product.image_path ? String(product.image_path) : "";
  if (!objectPath || objectPath.startsWith("/")) {
    return buildPlaceholderResponse(String(product.name ?? "Producto"));
  }

  const bucketName = getClubSiteMediaBucket();
  const signedRedirect = await createSignedStorageRedirect({
    supabase,
    bucketName,
    objectPath
  });

  if (signedRedirect) return signedRedirect;

  const streamedResponse = await createStorageObjectStreamResponse({
    supabase,
    bucketName,
    objectPath,
    contentType: "image/webp",
    cacheControl: CLUB_PRODUCT_IMAGE_CACHE_CONTROL
  });

  if (!streamedResponse) {
    return buildPlaceholderResponse(String(product.name ?? "Producto"));
  }

  return streamedResponse;
}
