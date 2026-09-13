import Link from "next/link";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { RecoveryForm } from "./recovery-form";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <Card className="mx-auto my-6 max-w-md">
    <CardTitle>Recuperar contraseña</CardTitle>
    <CardDescription className="mt-2">Te enviamos un enlace para elegir una nueva contraseña. Abrilo en este mismo navegador.</CardDescription>
    {error ? <p role="alert" className="mt-3 text-sm text-danger">El enlace venció o ya fue usado. Solicitá uno nuevo.</p> : null}
    <RecoveryForm />
    <Link href="/admin/login" className="mt-4 block text-sm text-emerald-300 underline">Volver a ingresar</Link>
  </Card>;
}
