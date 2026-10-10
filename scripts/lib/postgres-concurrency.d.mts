export function localConcurrencyDatabase(env?: Record<string, string | undefined>): {
  host: string; port: number; database: string; user: string; password: string;
  ssl: boolean; connectionTimeoutMillis: number; statement_timeout: number;
  query_timeout: number; idle_in_transaction_session_timeout: number; application_name: string;
};
export class PrivatePostgresError extends Error { code: string; label: string; constructor(label: string, error: unknown); }
export function assertLoopbackSocket(address: unknown): void;
