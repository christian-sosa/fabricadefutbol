import { createCompetitionAction } from "@/app/admin/(panel)/tournaments/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type LeagueTeamOption = {
  id: string;
  name: string;
  shortName: string | null;
};

export function CreateCompetitionCard({
  leagueId,
  leagueTeams,
  title = "Nueva competencia"
}: {
  leagueId: string;
  leagueTeams: LeagueTeamOption[];
  title?: string;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <CardTitle>{title}</CardTitle>
      <CardDescription className="mt-2">
        Crea una competencia con sus datos base, el formato y los equipos inscriptos iniciales. Luego podras sumar planteles, capitanes y fixture.
      </CardDescription>
      <form action={createCompetitionAction.bind(null, leagueId)} className="mt-4 space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Nombre</label>
            <Input name="name" placeholder="Ej: Viernes A" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Temporada</label>
            <Input defaultValue={String(new Date().getFullYear())} name="seasonLabel" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Formato</label>
            <Select defaultValue="league" name="type">
              <option value="league">Liga</option>
              <option value="cup">Copa</option>
              <option value="league_and_cup">Liga + copa</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Carga de datos</label>
            <Select defaultValue="full_stats" name="coverageMode">
              <option value="full_stats">Toda la info</option>
              <option value="results_only">Solo resultados</option>
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              En solo resultados se muestran tabla y fixture, sin goleadores, figuras ni vallas.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Playoff</label>
            <Select defaultValue="" name="playoffSize">
              <option value="">No aplica</option>
              <option value="4">Top 4</option>
              <option value="8">Top 8</option>
            </Select>
            <p className="mt-1 text-xs text-slate-500">Solo se usa en competencias Liga + copa.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200">Sede especifica</label>
            <Input name="venueOverride" placeholder="Opcional" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-200">Descripcion</label>
            <Textarea name="description" rows={3} />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-200">Equipos inscriptos</p>
          <p className="mt-1 text-xs text-slate-400">
            Selecciona los equipos que arrancan esta competencia. Si prefieres, puedes dejarla vacia y definirlos despues.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {leagueTeams.map((team) => (
              <label
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-200"
                key={team.id}
              >
                <input className="h-4 w-4 accent-emerald-400" name="leagueTeamIds" type="checkbox" value={team.id} />
                <span>
                  {team.name}
                  {team.shortName ? ` (${team.shortName})` : ""}
                </span>
              </label>
            ))}
            {!leagueTeams.length ? (
              <p className="text-sm text-slate-400">Primero necesitas cargar equipos maestros en la liga.</p>
            ) : null}
          </div>
        </div>

        <Button type="submit">Crear competencia</Button>
      </form>
    </Card>
  );
}
