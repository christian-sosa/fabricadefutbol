"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Enrollment = { id: string; qr: string; secret: string };
const FACTOR_NAME_PREFIX = "Fábrica de Fútbol ";

export function SecurityForm() {
  const router = useRouter();
  const [supabase] = useState(createSupabaseBrowserClient);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [factors, assurance] = await Promise.all([
          supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        ]);
        if (factors.error || assurance.error) throw new Error();
        if (!active) return;
        setFactorId(factors.data.totp[0]?.id ?? null);
        setVerified(assurance.data.currentLevel === "aal2");
        setReady(true);
      } catch {
        if (active) setError("No se pudo leer la seguridad de tu cuenta. Recargá la página para reintentar.");
      } finally { if (active) setPending(false); }
    }
    void load();
    return () => { active = false; };
  }, [supabase]);

  async function enroll() {
    setPending(true); setError(null); setSuccess(null);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      // Another tab may have completed enrollment since this screen loaded.
      if (factors.data.totp.length) { setFactorId(factors.data.totp[0].id); return; }
      const abandoned = factors.data.all.filter((factor) => factor.status === "unverified" && factor.factor_type === "totp" && factor.friendly_name?.startsWith(FACTOR_NAME_PREFIX));
      for (const factor of abandoned) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) throw removed.error;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `${FACTOR_NAME_PREFIX}${Date.now()}`, issuer: "Fábrica de Fútbol" });
      if (enrollError) throw enrollError;
      if (!/^data:image\/svg\+xml(?:;utf-8|;charset=utf-8|;base64)?,/i.test(data.totp.qr_code)) throw new Error("Invalid QR source");
      setEnrollment({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch { setError("No se pudo preparar el autenticador. Volvé a intentar."); }
    finally { setPending(false); }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedId = enrollment?.id ?? factorId;
    if (!selectedId || !/^\d{6}$/.test(code)) { setError("Ingresá los 6 dígitos de tu autenticador."); return; }
    setPending(true); setError(null);
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: selectedId, code });
      if (verifyError) throw verifyError;
      setFactorId(selectedId); setVerified(true); setEnrollment(null); setCode("");
      setSuccess("Segundo factor verificado. Ya podés continuar con tus grupos.");
      router.refresh();
    } catch { setError("El código no es válido o venció. Probá con el código actual de tu autenticador."); }
    finally { setPending(false); }
  }

  async function cancelEnrollment() {
    if (!enrollment) return;
    setPending(true); setError(null);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;
      const factor = factors.data.all.find((item) => item.id === enrollment.id);
      if (factor?.status === "verified") {
        setFactorId(factor.id); setEnrollment(null); setCode("");
        setError("Este autenticador ya está activo. Ingresá el código para verificar esta sesión.");
        return;
      }
      if (!factor) { setEnrollment(null); setCode(""); return; }
      const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
      if (removeError) throw removeError;
      setEnrollment(null); setCode("");
    } catch { setError("No se pudo cancelar la configuración. Volvé a intentar."); }
    finally { setPending(false); }
  }

  return (
    <div className="space-y-4" aria-busy={pending}>
      {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-300" role="status">{success}</p> : null}
      {!ready && pending ? <p role="status">Consultando tu cuenta…</p> : null}
      {ready && !factorId && !enrollment ? <Button disabled={pending} onClick={enroll} type="button">Activar doble factor</Button> : null}
      {factorId && verified && !enrollment ? <p className="text-sm text-emerald-300">Tu cuenta tiene doble factor activo.</p> : null}
      {enrollment ? <div className="space-y-3">
        <p className="text-sm text-slate-300">Escaneá el QR con tu autenticador y guardá la clave en un lugar seguro. No la compartas.</p>
        {/* Auth provides this QR as a data URI; no external image service receives the secret. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="QR para vincular tu autenticador" className="max-w-full rounded-lg bg-white p-2" width={220} height={220} src={enrollment.qr} />
        <details className="text-sm"><summary className="cursor-pointer py-3">Ingresar clave manualmente</summary><code className="break-all select-all">{enrollment.secret}</code></details>
      </div> : null}
      {enrollment || (factorId && !verified) ? <form className="space-y-3" onSubmit={verify}>
        <label className="block text-sm" htmlFor="mfa-code">Código del autenticador</label>
        <Input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
        <Button disabled={pending} type="submit">{pending ? "Verificando…" : "Verificar código"}</Button>
        {enrollment ? <Button disabled={pending} variant="secondary" type="button" onClick={cancelEnrollment}>Cancelar configuración</Button> : null}
      </form> : null}
    </div>
  );
}
