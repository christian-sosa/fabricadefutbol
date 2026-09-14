import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PlayerPhotoModalTrigger } from "@/components/ui/player-photo-modal-trigger";

describe("player photo dialog", () => {
  it("nombra la ventana, mantiene el teclado dentro y devuelve el foco al cerrar", async () => {
    const user = userEvent.setup();
    const { container } = render(<><button>Otra acción</button><PlayerPhotoModalTrigger hasPhoto={false} playerName="Ana" /></>);
    const trigger = screen.getByRole("button", { name: "Ver foto de Ana" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Foto de Ana" });
    const close = within(dialog).getByRole("button", { name: "Cerrar" });
    expect(close).toHaveFocus();
    expect(container.inert).toBe(true);
    await user.tab(); expect(close).toHaveFocus();
    await user.tab({ shift: true }); expect(close).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(container.inert).not.toBe(true);
  });
});
