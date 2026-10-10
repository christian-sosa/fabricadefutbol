export class E2eProcessExitError extends Error {
  constructor(code) {
    super(`La validación terminó con código ${code}.`);
    this.name = "E2eProcessExitError";
    this.code = code;
  }
}

export async function runE2eProjects({ projects, runProject, assertSafe, afterProject, reportFailure }) {
  const failures = [];
  for (const project of projects) {
    await assertSafe();
    try {
      await runProject(project);
    } catch (error) {
      // A failed assertion may not hide the other project's diagnostics.
      // Interruptions, lost leases and process-start errors stop immediately.
      if (!(error instanceof E2eProcessExitError)) throw error;
      await assertSafe();
      failures.push({ project, error });
      reportFailure?.(project, error);
    } finally {
      await afterProject?.(project);
    }
  }
  if (failures.length) throw new AggregateError(failures.map(({ error }) => error), `E2E falló en: ${failures.map(({ project }) => project).join(", ")}. Se conservaron los diagnósticos de todos los proyectos solicitados.`);
}
