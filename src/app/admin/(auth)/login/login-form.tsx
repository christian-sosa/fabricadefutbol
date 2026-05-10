"use client";

import { track } from "@vercel/analytics";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  loginWithGoogleAction,
  loginAdminAction,
  registerAdminAction,
  type LoginState,
  type RegisterState
} from "@/app/admin/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GROWTH_EVENTS } from "@/lib/growth";

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

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.43Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.41 13.89a6 6 0 0 1 0-3.78V7.52H3.06a10 10 0 0 0 0 8.96l3.35-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.99c1.47 0 2.79.51 3.82 1.5l2.87-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.52l3.35 2.59C7.2 7.75 9.4 5.99 12 5.99Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GoogleSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      className="h-11 w-full gap-3 border border-slate-700 bg-white text-slate-900 shadow-none hover:bg-slate-100 hover:brightness-100"
      disabled={pending}
      type="submit"
      variant="ghost"
    >
      <GoogleIcon />
      {pending ? "Conectando con Google..." : "Continuar con Google"}
    </Button>
  );
}

function RegisterSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      className="w-full"
      disabled={pending}
      onClick={() => track(GROWTH_EVENTS.signupStarted, { source: "login_form" })}
      type="submit"
      variant="secondary"
    >
      {pending ? "Creando cuenta..." : "Crear cuenta"}
    </Button>
  );
}

export function LoginForm({ nextPath = "/admin" }: { nextPath?: string }) {
  const [loginState, loginAction] = useActionState(loginAdminAction, initialLoginState);
  const [registerState, registerAction] = useActionState(registerAdminAction, initialRegisterState);

  return (
    <div className="space-y-4">
      <Card className="mx-auto max-w-xl">
        <CardTitle>Ingresar rapido</CardTitle>
        <CardDescription className="mt-2">
          Usa tu cuenta de Google para entrar al panel sin crear otra contrasena.
        </CardDescription>
        <form action={loginWithGoogleAction} className="mt-4">
          <input name="next" type="hidden" value={nextPath} />
          <GoogleSubmitButton />
        </form>
      </Card>

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
    </div>
  );
}
