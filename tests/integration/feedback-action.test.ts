import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn(), limit: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "test" }) }));
vi.mock("@/lib/feedback-email", () => ({ sendFeedbackEmail: mocks.send }));
vi.mock("@/lib/shared-rate-limit", () => ({ checkSharedRateLimit: mocks.limit }));
import { submitFeedbackAction } from "@/app/feedback/actions";
import type { FeedbackState } from "@/app/feedback/feedback-state";

const initial: FeedbackState = { status: "idle", message: null, errors: {}, values: { fullName: "", email: "", category: "sugerencia", organization: "", message: "" } };
function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ fullName: "Ana Pérez", email: "ana@example.test", category: "setup_help", organization: "Los viernes", message: "Necesito cargar veinte jugadores.", ...overrides })) data.set(key, value);
  return data;
}
describe("Contacto", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.limit.mockResolvedValue({ allowed: true }); mocks.send.mockResolvedValue(undefined); });
  it("conserva valores y errores por campo sin enviar datos inválidos", async () => {
    const state = await submitFeedbackAction(initial, form({ email: "invalid", message: "corto" }));
    expect(state.status).toBe("error");
    expect(state.values).toMatchObject({ fullName: "Ana Pérez", email: "invalid", organization: "Los viernes", message: "corto" });
    expect(state.errors).toMatchObject({ email: expect.any(String), message: expect.any(String) });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("permite reintentar un fallo de envío con la misma consulta", async () => {
    mocks.send.mockRejectedValueOnce(new Error("provider unavailable"));
    const failed = await submitFeedbackAction(initial, form());
    expect(failed).toMatchObject({ status: "error", values: { category: "setup_help", message: "Necesito cargar veinte jugadores." } });
    expect(await submitFeedbackAction(failed, form())).toMatchObject({ status: "success" });
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
  it("no envía al alcanzar el límite ni cuando se completa el honeypot", async () => {
    mocks.limit.mockResolvedValue({ allowed: false });
    expect(await submitFeedbackAction(initial, form())).toMatchObject({ status: "error", values: { message: "Necesito cargar veinte jugadores." } });
    expect(await submitFeedbackAction(initial, form({ website: "bot" }))).toMatchObject({ status: "success" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
