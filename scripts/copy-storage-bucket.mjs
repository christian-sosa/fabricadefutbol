import { createClient } from "@supabase/supabase-js";

const SOURCE_URL = process.env.SUPABASE_COPY_SOURCE_URL;
const SOURCE_KEY = process.env.SUPABASE_COPY_SOURCE_SERVICE_ROLE_KEY;
const TARGET_URL = process.env.SUPABASE_COPY_TARGET_URL;
const TARGET_KEY = process.env.SUPABASE_COPY_TARGET_SERVICE_ROLE_KEY;
const SOURCE_BUCKET = process.env.SUPABASE_COPY_SOURCE_BUCKET || process.env.SUPABASE_COPY_BUCKET || "player-photos";
const TARGET_BUCKET = process.env.SUPABASE_COPY_TARGET_BUCKET || process.env.SUPABASE_COPY_BUCKET || SOURCE_BUCKET;
const SOURCE_PREFIX = process.env.SUPABASE_COPY_SOURCE_PREFIX || "";
const TARGET_PREFIX = process.env.SUPABASE_COPY_TARGET_PREFIX || "";

function fail(message) {
  console.error(`\n[copy-storage-bucket] ${message}\n`);
  process.exit(1);
}

function makeClient(url, serviceRoleKey, schema = "public") {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema
    }
  });
}

function normalizePrefix(prefix) {
  if (!prefix) return "";
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

function mapTargetObjectName(sourceObjectName, sourcePrefixRaw, targetPrefixRaw) {
  const sourcePrefix = normalizePrefix(sourcePrefixRaw);
  const targetPrefix = normalizePrefix(targetPrefixRaw);
  if (sourcePrefix && !sourceObjectName.startsWith(sourcePrefix)) return null;

  const relativeName = sourcePrefix ? sourceObjectName.slice(sourcePrefix.length) : sourceObjectName;
  if (!relativeName) return null;
  return `${targetPrefix}${relativeName}`;
}

async function ensureTargetBucket(targetClient, bucketName) {
  const { error: createError } = await targetClient.storage.createBucket(bucketName, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/webp"]
  });

  if (createError && !/already exists/i.test(createError.message)) {
    fail(`No se pudo crear bucket destino "${bucketName}": ${createError.message}`);
  }

  const { error: updateError } = await targetClient.storage.updateBucket(bucketName, {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/webp"]
  });

  if (updateError) {
    fail(`No se pudo actualizar configuracion del bucket destino "${bucketName}": ${updateError.message}`);
  }
}

async function listSourceObjects(storageDbClient, bucketName) {
  const pageSize = 1000;
  let from = 0;
  const result = [];

  while (true) {
    const { data, error } = await storageDbClient
      .from("objects")
      .select("name, metadata")
      .eq("bucket_id", bucketName)
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      fail(`No se pudo listar objetos fuente en bucket "${bucketName}": ${error.message}`);
    }

    if (!data?.length) break;
    result.push(...data);
    from += pageSize;
  }

  const normalizedSourcePrefix = normalizePrefix(SOURCE_PREFIX);
  if (!normalizedSourcePrefix) return result;
  return result.filter((item) => item.name.startsWith(normalizedSourcePrefix));
}

async function main() {
  if (!SOURCE_URL) fail("Falta SUPABASE_COPY_SOURCE_URL");
  if (!SOURCE_KEY) fail("Falta SUPABASE_COPY_SOURCE_SERVICE_ROLE_KEY");
  if (!TARGET_URL) fail("Falta SUPABASE_COPY_TARGET_URL");
  if (!TARGET_KEY) fail("Falta SUPABASE_COPY_TARGET_SERVICE_ROLE_KEY");

  const sourceClient = makeClient(SOURCE_URL, SOURCE_KEY);
  const sourceStorageDb = makeClient(SOURCE_URL, SOURCE_KEY, "storage");
  const targetClient = makeClient(TARGET_URL, TARGET_KEY);

  await ensureTargetBucket(targetClient, TARGET_BUCKET);
  const sourceObjects = await listSourceObjects(sourceStorageDb, SOURCE_BUCKET);

  if (!sourceObjects.length) {
    console.log(`[copy-storage-bucket] No hay objetos para copiar en bucket "${SOURCE_BUCKET}".`);
    return;
  }

  console.log(`[copy-storage-bucket] Copiando ${sourceObjects.length} objetos de "${SOURCE_BUCKET}" a "${TARGET_BUCKET}"...`);

  let copied = 0;
  let skipped = 0;
  for (const item of sourceObjects) {
    const sourceObjectName = item.name;
    const targetObjectName = mapTargetObjectName(sourceObjectName, SOURCE_PREFIX, TARGET_PREFIX);
    if (!targetObjectName) {
      skipped += 1;
      continue;
    }
    const contentType =
      typeof item.metadata?.mimetype === "string" ? item.metadata.mimetype : "application/octet-stream";

    const { data: fileBlob, error: downloadError } = await sourceClient.storage
      .from(SOURCE_BUCKET)
      .download(sourceObjectName);

    if (downloadError || !fileBlob) {
      fail(`Error descargando "${sourceObjectName}": ${downloadError?.message ?? "sin detalle"}`);
    }

    const { error: uploadError } = await targetClient.storage.from(TARGET_BUCKET).upload(targetObjectName, fileBlob, {
      upsert: true,
      contentType
    });

    if (uploadError) {
      fail(`Error subiendo "${targetObjectName}" a destino: ${uploadError.message}`);
    }

    copied += 1;
    if (copied % 25 === 0 || copied === sourceObjects.length) {
      console.log(`[copy-storage-bucket] ${copied}/${sourceObjects.length}`);
    }
  }

  console.log(`[copy-storage-bucket] Copia finalizada. Copiados: ${copied}. Omitidos: ${skipped}.`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Error inesperado.");
});
