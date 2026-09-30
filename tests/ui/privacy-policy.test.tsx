import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

describe("políticas de Grupos", () => {
  it("describe el producto gratis y mantiene públicos los enlaces al ocultar el catálogo", async () => {
    render(await PrivacyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/Los jugadores no necesitan registrarse/)).toBeVisible();
    expect(screen.getByText(/los enlaces directos siguen siendo públicos/)).toBeVisible();
    expect(screen.queryByText(/AdSense|Mercado Pago|web beacons/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No envíes contraseñas, información médica/)).toBeVisible();
  });
  it("explica que Contacto requiere acuerdo manual y no crea una suscripción", async () => {
    render(await TermsPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/únicamente Grupos y es gratis/)).toBeVisible();
    expect(screen.getByText(/enviar una consulta no genera cobros ni una suscripción/)).toBeVisible();
    expect(screen.queryByText(/contratar un plan|nuevos modulos publicos/i)).not.toBeInTheDocument();
  });
});
