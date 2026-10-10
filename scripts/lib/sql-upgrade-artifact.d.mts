import type { SqlManifest } from "./sql-artifact.mjs";
export const UPGRADE_MIGRATIONS: Record<string, string>;
export const UPGRADE_FILES: readonly string[];
export const MAX_UPGRADE_BYTES: number;
export interface SqlUpgradeManifest extends SqlManifest {
  artifactKind: "sql-upgrades";
  fileSha256: Record<string, string>;
  baselines: Record<"audit" | "positions", SqlManifest>;
  migrations: Record<string, {version: string; name: string}>;
}
export function encodeUpgradeSources(sources: Record<string, string>): {bytes: Buffer; gzip: Buffer; sha256: string; fileSha256: Record<string, string>};
export function validateUpgradeManifest(manifest: unknown): SqlUpgradeManifest;
export function verifyUpgradeSources(sources: Record<string, string>, manifest: SqlUpgradeManifest): Record<string, string>;
export function decodeUpgradeArtifact(gzip: Uint8Array, manifest: SqlUpgradeManifest): Record<string, string>;
export function readUpgradeSources(root?: string): Record<string, string>;
export function publishUpgradeArtifact(artifact: Buffer, manifest: SqlUpgradeManifest, env: Record<string, string | undefined>, fetcher?: typeof fetch): Promise<void>;
