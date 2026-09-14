import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecurityForm } from "@/app/admin/(auth)/security/security-form";

const mocks = vi.hoisted(() => ({ listFactors: vi.fn(), getAuthenticatorAssuranceLevel: vi.fn(), enroll: vi.fn(), unenroll: vi.fn(), challengeAndVerify: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({ auth: { mfa: mocks } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
const pendingFactor = { id: "pending", status: "unverified", factor_type: "totp", friendly_name: "Fábrica de Fútbol 123" };
const qr = "data:image/svg+xml;utf-8,<svg></svg>";
function list(all: Array<typeof pendingFactor> = []) { return { data: { all, totp: all.filter((factor) => factor.status === "verified") }, error: null }; }

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listFactors.mockResolvedValue(list());
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
  mocks.enroll.mockResolvedValue({ data: { id: "pending", totp: { qr_code: qr, secret: "LOCAL-SECRET" } }, error: null });
  mocks.unenroll.mockResolvedValue({ error: null });
  mocks.challengeAndVerify.mockResolvedValue({ error: null });
});

async function enroll() {
  render(<SecurityForm />);
  await userEvent.click(await screen.findByRole("button", { name: "Activar doble factor" }));
  return screen.findByRole("textbox", { name: "Código del autenticador" });
}

describe("SecurityForm", () => {
  it("no habilita enrollment cuando falla la lectura inicial de factores", async () => {
    mocks.listFactors.mockResolvedValue({ data: null, error: new Error("offline") });
    render(<SecurityForm />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo leer");
    expect(screen.queryByRole("button", { name: "Activar doble factor" })).not.toBeInTheDocument();
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("muestra un QR local, conserva el código inválido y limpia secretos al verificar", async () => {
    const input = await enroll();
    expect(screen.getByRole("img")).toHaveAttribute("src", qr);
    mocks.challengeAndVerify.mockResolvedValueOnce({ error: new Error("expired") });
    await userEvent.type(input, "123456");
    await userEvent.click(screen.getByRole("button", { name: "Verificar código" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no es válido");
    expect(input).toHaveValue("123456");
    expect(screen.getByRole("img")).toBeInTheDocument();
    await userEvent.clear(input); await userEvent.type(input, "654321");
    await userEvent.click(screen.getByRole("button", { name: "Verificar código" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Segundo factor verificado");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("LOCAL-SECRET")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("nunca carga un QR externo con el secreto", async () => {
    mocks.enroll.mockResolvedValue({ data: { id: "pending", totp: { qr_code: "https://external.test/secret", secret: "LOCAL-SECRET" } }, error: null });
    render(<SecurityForm />);
    await userEvent.click(await screen.findByRole("button", { name: "Activar doble factor" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo preparar");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText("LOCAL-SECRET")).not.toBeInTheDocument();
  });
  it("limpia sólo TOTP propios sin verificar antes de empezar otra configuración", async () => {
    mocks.listFactors.mockResolvedValue(list([pendingFactor, { ...pendingFactor, id: "foreign", friendly_name: "Otra app" }, { ...pendingFactor, id: "phone", factor_type: "phone" }]));
    await enroll();
    expect(mocks.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: "pending" });
    expect(mocks.unenroll.mock.invocationCallOrder[0]).toBeLessThan(mocks.enroll.mock.invocationCallOrder[0]);
  });
  it("detiene la configuración si no puede limpiar un factor incompleto", async () => {
    mocks.listFactors.mockResolvedValue(list([pendingFactor]));
    mocks.unenroll.mockResolvedValue({ error: new Error("offline") });
    render(<SecurityForm />);
    await userEvent.click(await screen.findByRole("button", { name: "Activar doble factor" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo preparar");
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
  it("cancela el factor sin verificar actual y elimina su secreto de la pantalla", async () => {
    await enroll();
    mocks.listFactors.mockResolvedValue(list([pendingFactor]));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar configuración" }));
    await waitFor(() => expect(screen.queryByRole("img")).not.toBeInTheDocument());
    expect(mocks.unenroll).toHaveBeenCalledExactlyOnceWith({ factorId: "pending" });
    expect(screen.queryByText("LOCAL-SECRET")).not.toBeInTheDocument();
  });
  it("no elimina un factor que otra pestaña ya verificó", async () => {
    await enroll();
    mocks.listFactors.mockResolvedValue(list([{ ...pendingFactor, status: "verified" }]));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar configuración" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ya está activo");
    expect(mocks.unenroll).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Cancelar configuración" })).not.toBeInTheDocument();
  });
  it("no ofrece eliminar ni volver a crear un factor ya verificado", async () => {
    mocks.listFactors.mockResolvedValue(list([{ ...pendingFactor, status: "verified" }]));
    render(<SecurityForm />);
    expect(await screen.findByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar configuración" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activar doble factor" })).not.toBeInTheDocument();
    expect(mocks.unenroll).not.toHaveBeenCalled();
  });
});
