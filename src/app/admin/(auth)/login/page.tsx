import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/app/admin/(auth)/login/login-form";
import { resolveSafeNextPath } from "@/lib/auth/redirects";

type AdminLoginPageProps = {
  searchParams: Promise<{
    confirmed?: string;
    error?: string;
    next?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = resolveSafeNextPath(resolvedSearchParams.next, "/admin");
  return (
    <div className="mx-auto w-full max-w-md space-y-3 py-5 md:py-6">
      <div className="text-center">
        <h1 className="text-2xl font-black text-slate-100">Acceso al panel</h1>
      </div>

      {resolvedSearchParams.confirmed ? (
        <Card className="rounded-lg border-emerald-500/40 bg-emerald-500/10">
          <CardTitle>Email confirmado</CardTitle>
          <CardDescription className="mt-1">
            Tu cuenta ya qued&oacute; confirmada. Pod&eacute;s ingresar con tu email y contrase&ntilde;a.
          </CardDescription>
        </Card>
      ) : null}

      {resolvedSearchParams.error ? (
        <Card className="rounded-lg border-danger/40 bg-danger/10">
          <CardTitle>No se pudo confirmar</CardTitle>
          <CardDescription className="mt-1">{resolvedSearchParams.error}</CardDescription>
        </Card>
      ) : null}

      <LoginForm nextPath={nextPath} />
    </div>
  );
}
