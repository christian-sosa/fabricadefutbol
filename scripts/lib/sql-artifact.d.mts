export const SQL_FILES: readonly string[];
export const MAX_SQL_BYTES: number;
export interface SqlManifest { formatVersion: 1; revision: string; sha256: string; bucket: "groups-sql-artifacts"; object: string }
export function encodeSources(sources: Record<string, string>): {bytes: Buffer; gzip: Buffer; sha256: string};
export function validateManifest(manifest: unknown): SqlManifest;
export function decodeArtifact(gzip: Uint8Array, manifest: SqlManifest): Record<string, string>;
export function artifactConnection(env: Record<string, string | undefined>): {url: string; headers: Record<string, string>};
export function downloadArtifact(manifest: SqlManifest, env: Record<string, string | undefined>, fetcher?: typeof fetch): Promise<Buffer>;
export function publishArtifact(artifact: Buffer, manifest: SqlManifest, env: Record<string, string | undefined>, fetcher?: typeof fetch): Promise<void>;
