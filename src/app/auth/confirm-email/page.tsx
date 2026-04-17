import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

type ConfirmEmailPageProps = {
  searchParams: {
    token_hash?: string;
    type?: string;
    next?: string;
  };
};

function resolveNextPath(next?: string) {
  if (!next) return "/admin/login";
  if (!next.startsWith("/")) return "/admin/login";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/admin/login";
  return next;
}

export default function ConfirmEmailPage({ searchParams }: ConfirmEmailPageProps) {
  const tokenHash = searchParams.token_hash?.trim() ?? "";
  const type = searchParams.type?.trim() ?? "email";
  const nextPath = resolveNextPath(searchParams.next);

  if (!tokenHash) {
    return (
      <div className="py-6">
        <Card className="border-danger/40 bg-danger/10">
          <CardTitle>Enlace incompleto</CardTitle>
          <CardDescription className="mt-1">
            Este enlace no tiene la informacion necesaria para confirmar tu cuenta. Solicita un nuevo email e intenta otra vez.
          </CardDescription>
          <div className="mt-4">
            <Link className="text-sm font-semibold text-emerald-300 hover:underline" href="/admin/login">
              Volver al login
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="py-6">
      <Card>
        <CardTitle>Confirmar cuenta</CardTitle>
        <CardDescription className="mt-2">
          Para evitar que algunos proveedores de correo consuman el enlace antes de tiempo, confirma tu cuenta desde este boton.
        </CardDescription>

        <form action="/auth/confirm" className="mt-4">
          <input name="token_hash" type="hidden" value={tokenHash} />
          <input name="type" type="hidden" value={type} />
          <input name="next" type="hidden" value={nextPath} />
          <Button type="submit">Confirmar y continuar</Button>
        </form>

        <p className="mt-3 text-xs text-slate-400">
          Si ya confirmaste tu cuenta anteriormente, puedes intentar iniciar sesion directamente.
        </p>
      </Card>
    </div>
  );
}
