import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { DemoGroup } from "./demo-group";

export const metadata = { title: "Grupo de ejemplo", robots: { index: false, follow: true } };

export default function DemoPage() {
  return <div className="space-y-5">
    <Card>
      <p className="text-xs font-semibold uppercase text-amber-200">Demo · todos los datos son ficticios</p>
      <CardTitle className="mt-2 text-3xl">Los amigos del miércoles</CardTitle>
      <CardDescription className="mt-3">Explorá un grupo de 12 jugadores: el próximo partido, un resultado cargado y su ranking. Podés probar los equipos sin crear una cuenta.</CardDescription>
    </Card>
    <DemoGroup />
    <Card><CardTitle>Armá el próximo partido de tu grupo</CardTitle><CardDescription className="mt-2">Cargás jugadores, compartís los equipos y guardás el resultado. Los jugadores no necesitan registrarse.</CardDescription>
      <Link className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 font-semibold text-white" href="/admin/login?mode=register">Crear mi grupo gratis</Link>
    </Card>
  </div>;
}
