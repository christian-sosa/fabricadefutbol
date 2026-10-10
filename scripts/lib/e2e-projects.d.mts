export class E2eProcessExitError extends Error { code: number; constructor(code: number); }
export function runE2eProjects(options: {
  projects: string[];
  runProject: (project: string) => Promise<void>;
  assertSafe: () => Promise<void>;
  afterProject?: (project: string) => Promise<void>;
  reportFailure?: (project: string, error: Error) => void;
}): Promise<void>;
