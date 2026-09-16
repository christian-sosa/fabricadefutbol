"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import {
  loginWithGoogleAction,
  loginAdminAction,
  registerAdminAction,
  type LoginState,
  type RegisterState
} from "@/app/admin/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trackAnalyticsEvent } from "@/lib/analytics/client";
import { GROWTH_EVENTS } from "@/lib/growth";

const initialLoginState: LoginState = { error: null };
const initialRegisterState: RegisterState = { error: null, success: null };
type AuthMode = "login" | "register";

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  showRequirements = false
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: "new-password" | "current-password";
  showRequirements?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor={id}>{label}</label>
      <div className="relative">
        <Input
          aria-describedby={showRequirements ? `${id}-hint` : undefined}
          autoComplete={autoComplete}
          className="pr-24"
          id={id}
          minLength={showRequirements ? 6 : undefined}
          name={name}
          required
          type={visible ? "text" : "password"}
        />
        <button
          aria-controls={id}
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${name === "confirmPassword" ? "confirmación de contraseña" : "contraseña"}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 my-auto min-h-11 rounded-md px-3 text-sm font-semibold text-accent hover:text-slate-100"
          onClick={() => setVisible((value) => !value)}
          type="button"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {showRequirements ? <p className="mt-1.5 text-xs text-slate-400" id={`${id}-hint`}>Usá al menos 6 caracteres.</p> : null}
    </div>
  );
}

function LoginSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Ingresando..." : "Ingresar con email"}
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
      onClick={() => trackAnalyticsEvent(GROWTH_EVENTS.signupStarted, { source: "login_form" })}
      type="submit"
    >
      {pending ? "Creando cuenta..." : "Crear cuenta"}
    </Button>
  );
}

export function LoginForm({ nextPath = "/admin", initialMode = "login" }: { nextPath?: string; initialMode?: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginState, loginAction] = useActionState(loginAdminAction, initialLoginState);
  const [registerState, registerAction] = useActionState(registerAdminAction, initialRegisterState);
  const isRegisterMode = mode === "register";
  const isGroupRegistration = isRegisterMode && (nextPath === "/admin" || nextPath === "/admin/new");
  const isInvitation = nextPath.startsWith("/invite/");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-100">
          {isGroupRegistration ? "Creá tu grupo gratis" : isRegisterMode ? "Crear cuenta" : "Ingresar"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {isGroupRegistration
            ? "La cuenta es para quien organiza. Después elegís el nombre del grupo; los jugadores entran por un link."
            : isRegisterMode
              ? isInvitation ? "Creá tu cuenta para aceptar la invitación al grupo." : "Creá una cuenta para administrar tu grupo."
              : "Entrá con Google o con tu email para administrar tu grupo."}
        </p>
        {isGroupRegistration ? (
          <ol aria-label="Pasos para crear tu grupo" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <li aria-current="step" className="font-semibold text-accent">1. Tu cuenta</li>
            <li aria-hidden="true" className="text-slate-500">→</li>
            <li className="text-slate-400">2. Nombre del grupo</li>
          </ol>
        ) : null}
      </div>

      <Card className="mx-auto max-w-md space-y-4 p-5">
        <form action={loginWithGoogleAction}>
          <input name="next" type="hidden" value={nextPath} />
          <GoogleSubmitButton />
        </form>

        <div className="flex items-center gap-3 text-xs font-semibold uppercase text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          <span>o</span>
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        {isRegisterMode ? (
          <form action={registerAction} className="space-y-3">
            <input name="next" type="hidden" value={nextPath} />
            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="displayName">
                  Nombre
                </label>
                <Input autoComplete="name" id="displayName" name="displayName" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="registerEmail">
                  Email
                </label>
                <Input autoComplete="email" id="registerEmail" name="email" required type="email" />
              </div>
              <PasswordField autoComplete="new-password" id="registerPassword" label="Contraseña" name="password" showRequirements />
              <PasswordField autoComplete="new-password" id="confirmPassword" label="Confirmar contraseña" name="confirmPassword" />
            </div>

            {registerState.error ? <p className="text-sm font-semibold text-danger" role="alert">{registerState.error}</p> : null}
            {registerState.success ? (
              <p className="text-sm font-semibold text-emerald-300" role="status">{registerState.success}</p>
            ) : null}
            <RegisterSubmitButton />
          </form>
        ) : (
          <form action={loginAction} className="space-y-3">
            <input name="next" type="hidden" value={nextPath} />
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="email">
                Email
              </label>
              <Input autoComplete="email" id="email" name="email" required type="email" />
            </div>
            <PasswordField autoComplete="current-password" id="password" label="Contraseña" name="password" />

            {loginState.error ? <p className="text-sm font-semibold text-danger" role="alert">{loginState.error}</p> : null}
            <LoginSubmitButton />
            <Link className="block text-center text-sm font-semibold text-emerald-300 underline" href="/admin/forgot-password">Olvidé mi contraseña</Link>
          </form>
        )}

        <div className="border-t border-slate-800 pt-3 text-center text-sm text-slate-400">
          {isRegisterMode ? (
            <>
              &iquest;Ya ten&eacute;s cuenta?{" "}
              <button
                className="inline-flex min-h-11 items-center font-semibold text-accent transition hover:text-slate-100"
                onClick={() => setMode("login")}
                type="button"
              >
                Ingresar
              </button>
            </>
          ) : (
            <>
              &iquest;No ten&eacute;s cuenta?{" "}
              <button
                className="inline-flex min-h-11 items-center font-semibold text-accent transition hover:text-slate-100"
                onClick={() => setMode("register")}
                type="button"
              >
                Crear cuenta
              </button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
