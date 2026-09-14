export function fixtureLeaseRpc(action: "acquire" | "heartbeat" | "release", token: string, env: Record<string, string | undefined>, fetcher?: typeof fetch): Promise<boolean>;
export function startLeaseHeartbeat(renew: () => Promise<boolean>, onFailure: (error: Error) => void, intervalMs?: number): () => Promise<void>;
