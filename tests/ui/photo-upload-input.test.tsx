import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoUploadInput } from "@/components/admin/photo-upload-input";

const mocks = vi.hoisted(() => ({ prepare: vi.fn() }));
vi.mock("@/lib/prepare-player-photo", () => ({ preparePlayerPhoto: mocks.prepare }));

describe("PhotoUploadInput", () => {
  beforeEach(() => {
    mocks.prepare.mockReset();
    vi.stubGlobal("DataTransfer", class {
      files: File[] = [];
      items = { add: (file: File) => this.files.push(file) };
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("mantiene el input compacto con la misma altura que los controles de la planilla", () => {
    const { container } = render(<PhotoUploadInput compact hint="Foto" />);
    const wrapper = container.firstElementChild;
    const input = container.querySelector('input[type="file"]');

    expect(wrapper).toHaveClass("min-w-0");
    expect(input).toHaveClass("h-[38px]");
  });

  it("bloquea submit mientras prepara y reemplaza el original por el archivo comprimido", async () => {
    let finish!: (file: File) => void;
    mocks.prepare.mockReturnValue(new Promise<File>((resolve) => { finish = resolve; }));
    render(<PhotoUploadInput required={false} />);
    const input = screen.getByLabelText("Foto del jugador") as HTMLInputElement;
    const original = new File([new Uint8Array(8 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [original] } });
    expect(input.checkValidity()).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("Preparando foto");
    const prepared = new File([new Uint8Array(4000)], "large.webp", { type: "image/webp" });
    await act(async () => finish(prepared));
    expect(input.files?.[0]).toBe(prepared);
    expect(input.checkValidity()).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Foto lista");
  });

  it("anuncia el error y permite continuar sin una foto opcional", async () => {
    mocks.prepare.mockRejectedValue(new Error("La foto supera el límite."));
    render(<PhotoUploadInput required={false} />);
    const input = screen.getByLabelText("Foto del jugador") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["bad"], "bad.jpg")] } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("supera el límite"));
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Continuar sin foto" }));
    expect(input.checkValidity()).toBe(true);
    expect(input).toHaveAttribute("aria-invalid", "false");
  });

  it("descarta una preparación anterior cuando se selecciona otra foto", async () => {
    let finishOld!: (file: File) => void;
    const fresh = new File(["new"], "new.webp", { type: "image/webp" });
    mocks.prepare.mockReturnValueOnce(new Promise<File>((resolve) => { finishOld = resolve; })).mockResolvedValueOnce(fresh);
    render(<PhotoUploadInput />);
    const input = screen.getByLabelText("Foto del jugador") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["old"], "old.jpg")] } });
    fireEvent.change(input, { target: { files: [fresh] } });
    await waitFor(() => expect(input.files?.[0]).toBe(fresh));
    await act(async () => finishOld(new File(["old"], "old.webp")));
    expect(input.files?.[0]).toBe(fresh);
  });
});
