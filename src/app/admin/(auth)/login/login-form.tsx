"use client";

import { useFormState, useFormStatus } from "react-dom";

import { loginAdminAction, type LoginState } from "@/app/admin/(auth)/login/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={pending} type="submit">
      {pending ? "Ingresando..." : "Ingresar"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAdminAction, initialState);

  return (
    <Card className="mx-auto max-w-md">
      <CardTitle>Login Admin</CardTitle>
      <CardDescription>Solo para administradores autorizados.</CardDescription>

      <form action={formAction} className="mt-4 space-y-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="email">
            Email
          </label>
          <Input id="email" name="email" required type="email" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="password">
            Contrasena
          </label>
          <Input id="password" name="password" required type="password" />
        </div>

        {state.error ? <p className="text-sm font-semibold text-danger">{state.error}</p> : null}
        <SubmitButton />
      </form>
    </Card>
  );
}
