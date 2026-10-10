import { describe, expect, it, vi } from "vitest";
import { E2eProcessExitError, runE2eProjects } from "../../scripts/lib/e2e-projects.mjs";

describe("diagnóstico de proyectos E2E", () => {
  it("ejecuta mobile después de un fallo desktop y mantiene el resultado final fallido", async () => {
    const runProject = vi.fn(async (project: string) => { if (project === "chromium") throw new E2eProcessExitError(1); });
    const afterProject = vi.fn(async () => {});
    const assertSafe = vi.fn(async () => {});
    await expect(runE2eProjects({ projects: ["chromium", "mobile-chromium"], runProject, afterProject, assertSafe })).rejects.toMatchObject({ name: "AggregateError", message: expect.stringContaining("chromium") });
    expect(runProject.mock.calls.map(([project]) => project)).toEqual(["chromium", "mobile-chromium"]);
    expect(afterProject.mock.calls).toHaveLength(2);
    expect(assertSafe.mock.calls).toHaveLength(3);
  });

  it("no inicia mobile cuando se perdió el lease o falló la limpieza", async () => {
    const runProject = vi.fn(async () => { throw new E2eProcessExitError(1); });
    const safetyFailure = new Error("fixture no seguro");
    const assertSafe = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(safetyFailure);
    const afterProject = vi.fn(async () => {});
    await expect(runE2eProjects({ projects: ["chromium", "mobile-chromium"], runProject, afterProject, assertSafe })).rejects.toBe(safetyFailure);
    expect(runProject).toHaveBeenCalledTimes(1);
    expect(afterProject).toHaveBeenCalledTimes(1);
  });

  it("no continúa después de interrupciones ni errores al iniciar procesos", async () => {
    const failure = new Error("proceso interrumpido");
    const runProject = vi.fn(async () => { throw failure; });
    await expect(runE2eProjects({ projects: ["chromium", "mobile-chromium"], runProject, assertSafe: async () => {} })).rejects.toBe(failure);
    expect(runProject).toHaveBeenCalledTimes(1);
  });
});
