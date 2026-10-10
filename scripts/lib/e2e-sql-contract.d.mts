export type SqlContract = { formatVersion: 1; objects: Record<string, string>; artifactSha256?: string };
export const E2E_SQL_CONTRACT_QUERY: string;
export const STORAGE_PROVIDER_TRIGGER_HASHES: Readonly<Record<string, string>>;
export function getE2eSqlContractProbeSql(): string;
export function validateSqlContract(contract: unknown): SqlContract;
export function compareSqlContracts(expected: SqlContract, actual: SqlContract): { artifactSha256: string; checkedObjects: number };
export function buildExpectedSqlContract(root?: string): Promise<SqlContract>;
export function fetchInstalledSqlContract(env: Record<string, string | undefined>, fetcher?: typeof fetch): Promise<SqlContract>;
export function checkE2eSqlContract(options: { env: Record<string, string | undefined>; root?: string; fetcher?: typeof fetch }): Promise<{ artifactSha256: string; checkedObjects: number }>;
