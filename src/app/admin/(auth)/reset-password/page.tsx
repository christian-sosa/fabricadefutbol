import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/forgot-password?error=expired");
  return <Card className="mx-auto my-6 max-w-md">
    <CardTitle>Elegí una nueva contraseña</CardTitle>
    <CardDescription className="mt-2">Usá al menos 8 caracteres. Después vas a ingresar nuevamente.</CardDescription>
    <ResetForm />
    <Link className="mt-4 block text-sm text-emerald-300 underline" href="/admin/forgot-password">Solicitar otro enlace</Link>
  </Card>;
}
