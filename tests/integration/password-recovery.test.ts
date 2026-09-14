import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { factory, limit } = vi.hoisted(() => ({ factory: vi.fn(), limit: vi.fn(() => ({ allowed: true })) }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: factory }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/rate-limit", () => ({ getClientIpFromHeaders: () => "test-ip" }));
vi.mock("@/lib/shared-rate-limit", () => ({ checkSharedRateLimit: limit }));
import { requestPasswordRecovery } from "@/app/admin/(auth)/forgot-password/actions";
import { updateRecoveredPassword } from "@/app/admin/(auth)/reset-password/actions";
import { GET } from "@/app/auth/recovery/route";

const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };

describe("recuperación de contraseña", () => {
  beforeEach(() => { vi.clearAllMocks(); limit.mockReturnValue({ allowed: true }); process.env.APP_URL = "https://fdf.example"; });
  it("usa un destino fijo y responde sin confirmar si la cuenta existe", async () => {
    const resetPasswordForEmail = vi.fn(async () => ({ data: {}, error: null }));
    factory.mockResolvedValue({ auth: { resetPasswordForEmail } });
    const result = await requestPasswordRecovery({ error: null, success: null }, form({ email: "persona@example.com", next: "https://evil.example" }));
    expect(result.success).toContain("Si existe una cuenta");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("persona@example.com", { redirectTo: "https://fdf.example/auth/recovery" });
  });
  it("no solicita emails tras exceder el límite", async () => {
    limit.mockReturnValue({ allowed: false });
    expect((await requestPasswordRecovery({ error: null, success: null }, form({ email: "persona@example.com" }))).error).toContain("Esperá");
    expect(factory).not.toHaveBeenCalled();
  });
  it("rechaza un enlace usado y no permite redirecciones elegidas por el visitante", async () => {
    factory.mockResolvedValue({ auth: { exchangeCodeForSession: vi.fn(async () => ({ error: { message: "expired" } })) } });
    const response = await GET(new NextRequest("https://fdf.example/auth/recovery?code=used&next=https://evil.example"));
    expect(response.headers.get("location")).toBe("https://fdf.example/admin/forgot-password?error=expired");
  });
  it("solo verifica hashes como recovery", async () => {
    const verifyOtp = vi.fn(async () => ({ error: null }));
    factory.mockResolvedValue({ auth: { verifyOtp } });
    const response = await GET(new NextRequest("https://fdf.example/auth/recovery?token_hash=example&type=signup"));
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "example", type: "recovery" });
    expect(response.headers.get("location")).toBe("https://fdf.example/admin/reset-password");
  });
  it("no actualiza contraseñas sin una sesión validada por Supabase", async () => {
    const updateUser = vi.fn();
    factory.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: null }, error: null })), updateUser } });
    const result = await updateRecoveredPassword({ error: null }, form({ password: "new-password", confirmPassword: "new-password" }));
    expect(result.error).toContain("venció");
    expect(updateUser).not.toHaveBeenCalled();
  });
  it("cambia la contraseña y solicita cerrar las sesiones antes de volver al ingreso", async () => {
    const updateUser = vi.fn(async () => ({ error: null }));
    const signOut = vi.fn(async () => ({ error: null }));
    factory.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } }, error: null })), updateUser, signOut } });
    await expect(updateRecoveredPassword({ error: null }, form({ password: "new-password", confirmPassword: "new-password" }))).rejects.toThrow("redirect:/admin/login?reset=1");
    expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});
