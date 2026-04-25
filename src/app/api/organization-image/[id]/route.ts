import { NextResponse } from "next/server";

import { getOrganizationImagesBucket } from "@/lib/env";
import {
  buildOrganizationImagePlaceholderSvg,
  ORGANIZATION_IMAGE_CACHE_CONTROL,
  ORGANIZATION_IMAGE_PLACEHOLDER_CACHE_CONTROL
} from "@/lib/organization-images";
import {
  createSignedStorageRedirect,
  createStorageObjectStreamResponse
} from "@/lib/storage-image-responses";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function buildPlaceholderResponse(organizationName: string) {
  return new NextResponse(buildOrganizationImagePlaceholderSvg(organizationName), {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": ORGANIZATION_IMAGE_PLACEHOLDER_CACHE_CONTROL
    }
  });
}

export async function GET(
  _: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const { id: organizationId } = await context.params;
  const supabase = await createSupabaseServerClient();
  const { data: organization, error } = await supabase
    .from("organizations")
    .select("name, image_path")
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !organization) {
    return buildPlaceholderResponse("Grupo");
  }

  if (!organization.image_path) {
    return buildPlaceholderResponse(String(organization.name ?? "Grupo"));
  }

  const bucketName = getOrganizationImagesBucket();
  const objectPath = String(organization.image_path);
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
    cacheControl: ORGANIZATION_IMAGE_CACHE_CONTROL
  });

  if (!streamedResponse) {
    return buildPlaceholderResponse(String(organization.name ?? "Grupo"));
  }

  return streamedResponse;
}
