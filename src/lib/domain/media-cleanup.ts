import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
type CleanupJob = { id: string; bucketName: string; objectPath: string; leaseToken: string };

/** Persist first: even a process exit or Storage outage leaves a retryable job. */
export async function enqueueMediaCleanup(bucketName: string, objectPath: string, pendingUpload = false) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("No se pudo registrar la limpieza de la foto.");
  const { error } = await supabase.rpc("enqueue_media_cleanup", { p_bucket: bucketName, p_path: objectPath, p_pending_upload: pendingUpload });
  if (error) throw new Error(error.message);
}

export async function processMediaCleanup(supabase: AdminClient, limit = 25) {
  // Claim checks live photo/cover references; SQL prevents reattaching queued revisions.
  const { data, error } = await supabase.rpc("claim_media_cleanup", { p_limit: limit });
  if (error) throw new Error(error.message);
  const jobs = (data ?? []) as CleanupJob[];
  const summary = { attempted: jobs.length, deleted: 0, failed: 0 };
  for (const job of jobs) {
    let failure: string | null = null;
    try {
      const { error: removeError } = await supabase.storage.from(job.bucketName).remove([job.objectPath]);
      failure = removeError?.message ?? null;
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : "No se pudo quitar la foto.";
    }
    const { error: finishError } = await supabase.rpc("complete_media_cleanup", {
      p_job_id: job.id, p_lease_token: job.leaseToken, p_error: failure
    });
    if (finishError) throw new Error(finishError.message);
    if (failure) summary.failed += 1;
    else summary.deleted += 1;
  }
  return summary;
}
