import { describe, expect, it } from "vitest";
import { formActionResult } from "@/lib/form-action-result";

function redirectTo(url: string) { return Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;push;${url};307;` }); }
describe("form error adapter", () => {
  it("devuelve sólo el error de la pantalla esperada", async () => {
    const result = await formActionResult(async () => { throw redirectTo("/admin/players?org=a&error=Nombre%20requerido"); }, new FormData(), "/admin/players");
    expect(result).toEqual({ error: "Nombre requerido" });
  });
  it.each(["/admin/login?error=Sesión", "/admin/players?success=Creado", "https://otro.test/admin/players?error=No"])("propaga navegación y autenticación: %s", async (url) => {
    const error = redirectTo(url);
    await expect(formActionResult(async () => { throw error; }, new FormData(), "/admin/players")).rejects.toBe(error);
  });
});
