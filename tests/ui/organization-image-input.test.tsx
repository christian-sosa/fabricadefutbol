import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganizationImageInput } from "@/components/admin/organization-image-input";

const mocks = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock("@/lib/prepare-organization-image", () => ({ prepareOrganizationImage: mocks.prepare }));
beforeEach(() => {
  mocks.prepare.mockReset();
  vi.stubGlobal("DataTransfer", class { files: File[] = []; items = { add: (file: File) => this.files.push(file) }; });
});
describe("cover input", () => {
  it("bloquea el envío del original y descarta una preparación anterior", async () => {
    let finish!: (file: File) => void;
    const prepared = new File(["new"], "portada.webp", { type: "image/webp" });
    mocks.prepare.mockReturnValueOnce(new Promise<File>((resolve) => { finish = resolve; })).mockResolvedValueOnce(prepared);
    render(<OrganizationImageInput />);
    const input = screen.getByLabelText("Foto de portada") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["old"], "old.jpg", { type: "image/jpeg" })] } });
    expect(input.checkValidity()).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("Preparando portada");
    fireEvent.change(input, { target: { files: [new File(["new"], "new.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(input.files?.[0]).toBe(prepared));
    await act(async () => finish(new File(["old"], "old.webp", { type: "image/webp" })));
    expect(input.files?.[0]).toBe(prepared);
    expect(input.validity.customError).toBe(false);
  });
  it("anuncia el fallo sin permitir subir el archivo original", async () => {
    mocks.prepare.mockRejectedValue(new Error("El archivo original supera 20 MB."));
    render(<OrganizationImageInput />);
    const input = screen.getByLabelText("Foto de portada") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["bad"], "bad.jpg")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("20 MB");
    expect(input.checkValidity()).toBe(false);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});
