import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGroupsOperationsReport, collectGroupsOperationsReport, listStorageObjects, parseOperationsArguments, resolveOperationsConfiguration } from "../../scripts/report-groups-operations.mjs";
import type { OperationsConfiguration } from "../../scripts/report-groups-operations.mjs";
import { createFakeSupabase } from "../helpers/fake-supabase";

const now = new Date("2026-09-30T15:00:00Z");
const configuration: OperationsConfiguration = { target: "development", schema: "app_dev", photosBucket: "photos-dev", imagesBucket: "images-dev", url: "https://example.supabase.co", key: "test-secret-not-a-credential" };

describe("reporte operativo agregado de Grupos", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("exige selector explícito y no toma credenciales PROD cuando falta la credencial DEV", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_TARGET_ENV", "");
    await expect(resolveOperationsConfiguration()).rejects.toThrow("explícitamente");
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_TARGET_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL_DEV", "https://development.example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV", "app_dev");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY_DEV", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "fake-production-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY_PROD", "fake-production-key");
    await expect(resolveOperationsConfiguration()).rejects.toThrow("Falta la credencial");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY_DEV", "fake-development-key");
    const selected = await resolveOperationsConfiguration();
    expect(selected.target).toBe("development");
    expect(selected.schema).toBe("app_dev");
    expect(selected.key).toBe("fake-development-key");
  });

  it("recorre carpetas y páginas incluso con un límite menor al solicitado", async () => {
    const files = Array.from({ length: 1105 }, (_, index) => ({ id: `object-${index}`, name: `${String(index).padStart(4, "0")}.webp`, metadata: { size: 100 } }));
    const list = vi.fn(async (folder: string, { offset }: { offset: number }) => ({ data: (folder === "app_dev" ? [{ id: null, name: "group", metadata: null }] : files).slice(offset, offset + 73), error: null }));
    const storage = { from: vi.fn(() => ({ list })) };
    const objects = await listStorageObjects(storage, "photos", "app_dev");
    expect(objects).toHaveLength(1105);
    expect(new Set(objects.map((object) => object.path)).size).toBe(1105);
    expect(list).toHaveBeenCalledWith("app_dev/group", { limit: 200, offset: 73, sortBy: { column: "name", order: "asc" } });
    expect(list.mock.calls.at(-1)?.[1].offset).toBe(1105);
  });

  it("agrega recursos y actividad sin emitir nombres, ids, rutas ni credenciales", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: "private-org-id", name: "Nombre privado", slug: "private-slug", archived_at: null }],
      players: [
        { id: "personal-player-id", organization_id: "private-org-id", full_name: "Persona privada", active: true, photo_path: "app_dev/private-org-id/personal-player-id/revision.webp" },
        { id: "legacy-player", organization_id: "private-org-id", full_name: "Otra persona privada", active: false, photo_path: "private-org-id/legacy-player.webp" }
      ],
      matches: [
        { id: "recent-match", organization_id: "private-org-id", status: "finished", finished_at: "2026-09-29T15:00:00Z" },
        { id: "old-match", organization_id: "private-org-id", status: "finished", finished_at: "2026-08-01T15:00:00Z" },
        { id: "future-match", organization_id: "private-org-id", status: "finished", finished_at: "2026-10-01T15:00:00Z" }
      ]
    });
    const inventory: Record<string, Array<{ id: string | null; name: string; metadata: { size?: unknown } | null }>> = {
      "photos-dev:app_dev": [{ id: null, name: "private-org-id", metadata: null }],
      "photos-dev:app_dev/private-org-id": [{ id: null, name: "personal-player-id", metadata: null }],
      "photos-dev:app_dev/private-org-id/personal-player-id": [{ id: "obj", name: "revision.webp", metadata: { size: "200" } }],
      "photos-dev:private-org-id": [{ id: "legacy", name: "legacy-player.webp", metadata: { size: 100 } }],
      "images-dev:app_dev/organizations": [{ id: "cover", name: "private-org-id.webp", metadata: { size: 500 } }]
    };
    const reads: string[] = [];
    const storage = { from: (bucket: string) => ({ list: async (folder: string, { offset }: { offset: number }) => {
      reads.push(`${bucket}:${folder}`);
      return { data: (inventory[`${bucket}:${folder}`] ?? []).slice(offset, offset + 200), error: null };
    } }) };
    const client = Object.assign(fake.client, { storage }) as unknown as Parameters<typeof collectGroupsOperationsReport>[0]["client"];
    const report = await collectGroupsOperationsReport({ client, configuration, now });
    expect(report.totals).toMatchObject({ groups: 1, activeGroups: 1, players: 2, activePlayers: 1, playersWithPhoto: 2, finishedMatchesLast30Days: 1, storage: { objects: 3, playerPhotoObjects: 2, organizationImageObjects: 1, bytes: 800 } });
    expect(report.groups[0]).toMatchObject({ groupNumber: 1, storage: { bytes: 800 } });
    expect(report.economics.monthlyOperatingCost).toBeNull();
    expect(report.economics.monthlyEmailCount).toBeNull();
    const serialized = JSON.stringify(report);
    for (const privateValue of ["private-org-id", "personal-player-id", "Persona privada", "Nombre privado", "private-slug", "revision.webp", configuration.url, configuration.key]) expect(serialized).not.toContain(privateValue);
    expect(reads.every((path) => !path.includes("app_prod"))).toBe(true);
  });

  it("identifica bytes desconocidos, archivos huérfanos y grupos archivados sin suponer tamaños", () => {
    const report = buildGroupsOperationsReport({
      schema: "app_dev", target: "development", now,
      organizations: [{ id: "group", archived_at: "2026-09-01" }], players: [],
      matches: [{ organization_id: "group", status: "finished", finished_at: "2026-09-29T12:00:00Z" }],
      objects: [
        { bucket: "photos", path: "app_dev/group/player/a.webp", size: 0 },
        { bucket: "photos", path: "app_dev/deleted/player/b.webp", size: undefined },
        { bucket: "photos", path: "app_dev/group/player/a.webp", size: 0 }
      ]
    });
    expect(report.totals.activeGroups).toBe(0);
    expect(report.groups[0].storage.bytes).toBe(0);
    expect(report.totals.storage).toMatchObject({ objects: 2, bytes: null, measuredBytes: 0, objectsWithUnknownSize: 1 });
    expect(report.totals.unattributedStorage.objects).toBe(1);
    expect(report.economics.monthlyOperatingCostPerActiveGroup).toBeNull();
  });

  it("calcula la unidad económica sólo con inputs explícitos y distingue datos faltantes de cero", () => {
    const input = { schema: "app_dev", target: "development", now, organizations: [{ id: "group" }], players: [], objects: [], matches: [{ organization_id: "group", status: "finished", finished_at: "2026-09-29T12:00:00Z" }] };
    const partial = buildGroupsOperationsReport({ ...input, costs: { currency: "ARS", monthlyInfrastructureCost: 120 } });
    expect(partial.economics.monthlyOperatingCost).toBeNull();
    expect(partial.economics.monthlyInfrastructureCostPerActiveGroup).toBe(120);
    const complete = buildGroupsOperationsReport({ ...input, costs: { currency: "ARS", monthlyInfrastructureCost: 120, monthlyEmailCost: 0, monthlyEmailCount: 4, monthlySupportMinutes: 60, supportHourlyCost: 20 } });
    expect(complete.economics).toMatchObject({ monthlyOperatingCost: 140, monthlyOperatingCostPerActiveGroup: 140, monthlySupportCost: 20, monthlyEmailCost: 0, missingInputs: [] });
  });

  it("no incluye errores del proveedor en los errores de inventario", async () => {
    const storage = { from: () => ({ list: async () => ({ data: null, error: { message: "secret-key / personal-player-path" } }) }) };
    await expect(listStorageObjects(storage, "photos", "app_dev")).rejects.toThrow("No se pudo consultar el inventario de Storage.");
  });

  it("valida los inputs y ofrece ayuda sin cargar credenciales ni consultar Supabase", () => {
    expect(parseOperationsArguments(["--monthly-email-count=0", "--monthly-support-minutes", "30"])).toMatchObject({ costs: { monthlyEmailCount: 0, monthlySupportMinutes: 30 } });
    expect(() => parseOperationsArguments(["--monthly-infrastructure-cost=1"])).toThrow("moneda");
    expect(() => parseOperationsArguments(["--monthly-email-count=-1"])).toThrow("inválido");
    expect(() => parseOperationsArguments(["--monthly-email-count=1.5"])).toThrow("entero");
    const help = execFileSync(process.execPath, ["scripts/report-groups-operations.mjs", "--help"], { encoding: "utf8" });
    expect(help).toContain("sólo lectura");
    const rejected = spawnSync(process.execPath, ["scripts/report-groups-operations.mjs", "--unknown=private@example.test"], { encoding: "utf8" });
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).not.toContain("private@example.test");
    expect(rejected.stdout).toBe("");
  });
});
