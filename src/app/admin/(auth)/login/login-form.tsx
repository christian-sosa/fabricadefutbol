"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  loginAdminAction,
  registerAdminAction,
  type LoginState,
  type RegisterState
} from "@/app/admin/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialLoginState: LoginState = { error: null };
const initialRegisterState: RegisterState = { error: null, success: null };

function LoginSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Ingresando..." : "Ingresar"}
    </Button>
  );
}

function RegisterSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending} type="submit" variant="secondary">
      {pending ? "Creando cuenta..." : "Crear cuenta"}
    </Button>
  );
}

export function LoginForm({ nextPath = "/admin" }: { nextPath?: string }) {
  const [loginState, loginAction] = useActionState(loginAdminAction, initialLoginState);
  const [registerState, registerAction] = useActionState(registerAdminAction, initialRegisterState);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardTitle>Ingresar</CardTitle>
        <CardDescription>Accede al panel con tu email y contrasena.</CardDescription>

        <form action={loginAction} className="mt-4 space-y-3">
          <input name="next" type="hidden" value={nextPath} />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="email">
              Email
            </label>
            <Input autoComplete="email" id="email" name="email" required type="email" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="password">
              Contrasena
            </label>
            <Input autoComplete="current-password" id="password" name="password" required type="password" />
          </div>

          {loginState.error ? <p className="text-sm font-semibold text-danger">{loginState.error}</p> : null}
          <LoginSubmitButton />
        </form>
      </Card>

      <Card>
        <CardTitle>Registrarse</CardTitle>
        <CardDescription>
            Crea una cuenta para administrar tu grupo o aceptar invitaciones.
        </CardDescription>

        <form action={registerAction} className="mt-4 space-y-3">
          <input name="next" type="hidden" value={nextPath} />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="displayName">
              Nombre
            </label>
            <Input id="displayName" name="displayName" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="registerEmail">
              Email
            </label>
            <Input autoComplete="email" id="registerEmail" name="email" required type="email" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="registerPassword">
              Contrasena
            </label>
            <Input autoComplete="new-password" id="registerPassword" name="password" required type="password" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="confirmPassword">
              Confirmar contrasena
            </label>
            <Input autoComplete="new-password" id="confirmPassword" name="confirmPassword" required type="password" />
          </div>

          {registerState.error ? <p className="text-sm font-semibold text-danger">{registerState.error}</p> : null}
          {registerState.success ? (
            <p className="text-sm font-semibold text-emerald-300">{registerState.success}</p>
          ) : null}
          <RegisterSubmitButton />
        </form>
      </Card>
    </div>
  );
}
