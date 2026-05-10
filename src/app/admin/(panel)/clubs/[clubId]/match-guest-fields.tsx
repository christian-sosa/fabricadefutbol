"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const MAX_GUEST_SLOTS = 6;

export function MatchGuestFields() {
  const [slots, setSlots] = useState<number[]>([]);

  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-slate-200">Invitados</p>
        {slots.length < MAX_GUEST_SLOTS ? (
          <Button
            className="w-fit"
            onClick={() => setSlots((current) => [...current, (current[current.length - 1] ?? 0) + 1])}
            type="button"
            variant="secondary"
          >
            Agregar invitado
          </Button>
        ) : null}
      </div>
      {slots.length ? (
        <div className="mt-2 grid gap-3">
          {slots.map((slot) => (
            <div className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 md:grid-cols-[1fr_170px_90px_90px_80px_160px_110px]" key={slot}>
              <Input name={`guestName:${slot}`} placeholder="Nombre" />
              <Select defaultValue="starter" name={`guestRole:${slot}`}>
                <option value="starter">Titular</option>
                <option value="substitute">Suplente</option>
                <option value="present">Presente, no entro</option>
              </Select>
              <Input min={0} name={`guestGoals:${slot}`} placeholder="Goles" type="number" />
              <Input min={0} name={`guestAssists:${slot}`} placeholder="Asist." type="number" />
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input className="h-4 w-4 accent-emerald-400" name="mvp" type="radio" value={`guest:${slot}`} />
                Figura
              </label>
              <Select aria-label={`Pago cancha invitado ${slot}`} defaultValue="unpaid" name={`guestPaymentStatus:${slot}`}>
                <option value="unpaid">No pago</option>
                <option value="paid">Pago completo</option>
                <option value="partial">Pago parcial</option>
              </Select>
              <Input
                aria-label={`Monto pagado invitado ${slot}`}
                min={0}
                name={`guestPaidAmount:${slot}`}
                placeholder="$"
                step="0.01"
                type="number"
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
