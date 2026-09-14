export function readEnvFile(filepath?: string): Record<string, string>;
export function readE2eEnvironment(processValues?: Record<string, string | undefined>, filepath?: string): Record<string, string>;
export function validateE2eEnvironment(env: Record<string, string | undefined>): Record<string, string>;
