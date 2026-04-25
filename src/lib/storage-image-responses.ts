import { NextResponse } from "next/server";

export const REPLACEABLE_IMAGE_UPLOAD_CACHE_CONTROL = "3600";
export const SIGNED_IMAGE_URL_TTL_SECONDS = 10 * 60;
export const SIGNED_IMAGE_REDIRECT_CACHE_CONTROL = "private, max-age=300";

type StorageError = {
  message?: string;
};

type StorageBucket = {
  createSignedUrl(
    objectPath: string,
    expiresIn: number
  ): Promise<{
    data: { signedUrl: string } | null;
    error: StorageError | null;
  }>;
  download(objectPath: string): Promise<{
    data: Blob | null;
    error: StorageError | null;
  }>;
};

export type StorageClient = {
  storage: {
    from(bucketName: string): StorageBucket;
  };
};

export async function createSignedStorageRedirect(params: {
  supabase: StorageClient;
  bucketName: string;
  objectPath: string;
}) {
  const { data, error } = await params.supabase.storage
    .from(params.bucketName)
    .createSignedUrl(params.objectPath, SIGNED_IMAGE_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;

  const response = NextResponse.redirect(data.signedUrl, { status: 307 });
  response.headers.set("cache-control", SIGNED_IMAGE_REDIRECT_CACHE_CONTROL);
  return response;
}

export async function createStorageObjectStreamResponse(params: {
  supabase: StorageClient;
  bucketName: string;
  objectPath: string;
  contentType: string;
  cacheControl: string;
}) {
  const { data, error } = await params.supabase.storage
    .from(params.bucketName)
    .download(params.objectPath);

  if (error || !data) return null;

  return new Response(data.stream(), {
    headers: {
      "content-type": params.contentType,
      "cache-control": params.cacheControl
    }
  });
}
