import { LoginForm } from "@/app/admin/(auth)/login/login-form";

export default function AdminLoginPage() {
  return (
    <div className="py-6">
      <h1 className="mb-4 text-center text-3xl font-black text-slate-100">Acceso al Panel</h1>
      <LoginForm />
    </div>
  );
}
