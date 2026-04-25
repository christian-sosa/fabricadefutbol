import { NextResponse } from "next/server";

import { getOrganizationImagesBucket } from "@/lib/env";
import {
  buildOrganizationImagePlaceholderSvg,
  ORGANIZATION_IMAGE_CACHE_CONTROL,
  ORGANIZATION_IMAGE_PLACEHOLDER_CACHE_CONTROL
} from "@/lib/organization-images";
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

  const { data: file, error: downloadError } = await supabase.storage
    .from(getOrganizationImagesBucket())
    .download(String(organization.image_path));

  if (downloadError || !file) {
    return buildPlaceholderResponse(String(organization.name ?? "Grupo"));
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  return new NextResponse(fileBuffer, {
    headers: {
      "content-type": "image/webp",
      "cache-control": ORGANIZATION_IMAGE_CACHE_CONTROL
    }
  });
}
