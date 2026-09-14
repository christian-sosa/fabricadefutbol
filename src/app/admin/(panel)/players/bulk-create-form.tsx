"use client";
import { useActionState, useState } from "react";
import { bulkCreatePlayersAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function BulkCreatePlayersForm({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(bulkCreatePlayersAction, { error: null });
  const [names, setNames] = useState("");
  return <form action={action} aria-busy={pending} className="mt-4 space-y-3">
    <input name="organizationId" type="hidden" value={organizationId} />
    <label className="block text-sm font-semibold" htmlFor="player-names">Nombres de jugadores, uno por línea</label>
    <Textarea aria-describedby="player-names-help" aria-invalid={Boolean(state.error)} id="player-names" maxLength={6000} name="names" onChange={(event) => setNames(event.target.value)} placeholder={"Juan Pérez\nNico López\nDiego Ruiz"} required rows={8} value={names} />
    <p className="text-xs text-slate-400" id="player-names-help">Hasta 60 nombres. Los repetidos y los que ya están en el grupo se omiten. Empiezan con nivel Intermedio; después podés ajustar niveles y fotos.</p>
    {state.error ? <p className="text-sm text-danger" role="alert">{state.error}</p> : null}
    <Button disabled={pending} type="submit">{pending ? "Cargando jugadores…" : "Cargar lista de jugadores"}</Button>
  </form>;
}
