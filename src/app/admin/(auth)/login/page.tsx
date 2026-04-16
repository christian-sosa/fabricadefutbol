import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/app/admin/(auth)/login/login-form";

type AdminLoginPageProps = {
  searchParams: {
    confirmed?: string;
    error?: string;
  };
};

export default function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  return (
    <div className="space-y-4 py-6">
      <h1 className="mb-4 text-center text-3xl font-black text-slate-100">Acceso al Panel</h1>

      {searchParams.confirmed ? (
        <Card className="border-emerald-500/40 bg-emerald-500/10">
          <CardTitle>Email confirmado</CardTitle>
          <CardDescription className="mt-1">
            Tu cuenta ya quedo confirmada. Puedes ingresar con tu email y contrasena.
          </CardDescription>
        </Card>
      ) : null}

      {searchParams.error ? (
        <Card className="border-danger/40 bg-danger/10">
          <CardTitle>No se pudo confirmar</CardTitle>
          <CardDescription className="mt-1">{searchParams.error}</CardDescription>
        </Card>
      ) : null}

      <LoginForm />
    </div>
  );
}
