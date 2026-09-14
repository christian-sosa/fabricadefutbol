import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth/admin";
import { SecurityForm } from "./security-form";

export default async function SecurityPage() {
  const admin = await getAdminSession();
  if (!admin) redirect("/admin/login?next=/admin/security");
  return (
    <section className="mx-auto max-w-lg space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Seguridad de la cuenta</h1>
        <p className="mt-2 text-sm text-slate-300">Protegé tu cuenta con una aplicación autenticadora. Después de activarla, te pediremos su código al ingresar.</p>
      </div>
      <SecurityForm />
      <Link className="inline-flex min-h-11 items-center text-sm text-emerald-300 underline" href="/admin">Volver a mis grupos</Link>
    </section>
  );
}
