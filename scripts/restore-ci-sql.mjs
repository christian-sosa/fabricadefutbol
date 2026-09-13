import { mkdir, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const bundle = process.env.GROUPS_SQL_BUNDLE_GZIP_BASE64;
if (!bundle) throw new Error("Falta el artefacto SQL privado de CI. No se puede declarar validada la base.");
const files = JSON.parse(gunzipSync(Buffer.from(bundle, "base64"), { maxOutputLength: 1_000_000 }).toString("utf8"));
await mkdir("supabase", { recursive: true });
for (const name of ["schema.sql", "policies.sql", "group-match-workflow.sql"]) {
  if (typeof files[name] !== "string" || files[name].length < 100) throw new Error(`Fuente SQL incompleta: ${name}`);
  await writeFile(`supabase/${name}`, files[name], "utf8");
}
console.log("Fuentes SQL privadas restauradas para validación; permanecen fuera de Git.");
