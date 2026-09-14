import {
  getFormationPositions,
  type FormationPlayer,
  type TeamFormation
} from "@/lib/domain/match-formation";
import { cn } from "@/lib/utils";

type FormationPitchProps = {
  teamLabel: string;
  side: "A" | "B";
  formation: TeamFormation;
  players: FormationPlayer[];
  selectedSlotId?: string;
  controlsId?: string;
  onSelectSlot?: (slotId: string) => void;
};

function Shirt({ side, isGoalkeeper }: { side: "A" | "B"; isGoalkeeper: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "h-10 w-10 shrink-0 drop-shadow-md",
        isGoalkeeper ? "text-slate-300" : side === "A" ? "text-blue-600" : "text-red-600"
      )}
      focusable="false"
      viewBox="0 0 48 52"
    >
      <path
        d="M16 5 9 8 2 20 10 25 14 19V47H34V19L38 25 46 20 39 8 32 5 29 9H19Z"
        fill="currentColor"
        stroke="#09241f"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M16 5Q24 16 32 5" fill="none" stroke="#09241f" strokeWidth="2" />
      <path d="M29 14H34V46H29Z" fill="#000" opacity=".12" />
      <path d="M11 11 7 19M37 11 41 19" fill="none" opacity=".4" stroke="#fff" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function PitchLines() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-white/65"
      fill="none"
      focusable="false"
      preserveAspectRatio="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 400 520"
    >
      <path d="M14 14H386V506H14Z M14 260H386" />
      <circle cx="200" cy="260" r="51" />
      <circle cx="200" cy="260" fill="currentColor" r="2.5" stroke="none" />
      <path d="M113 14V91H287V14 M151 14V44H249V14 M181 14V7H219V14" />
      <path d="M113 506V429H287V506 M151 506V476H249V506 M181 506V513H219V506" />
      <path d="M165 91Q200 122 235 91 M165 429Q200 398 235 429" />
      <circle cx="200" cy="70" fill="currentColor" r="2" stroke="none" />
      <circle cx="200" cy="450" fill="currentColor" r="2" stroke="none" />
      <path d="M14 27Q27 27 27 14 M373 14Q373 27 386 27 M14 493Q27 493 27 506 M373 506Q373 493 386 493" />
    </svg>
  );
}

export function FormationPitch({ teamLabel, side, formation, players, selectedSlotId, controlsId, onSelectSlot }: FormationPitchProps) {
  const positions = getFormationPositions(formation.formationId);
  const playersById = new Map(players.map((player) => [player.participantId, player]));
  const assignedPlayers = new Map(formation.slots.map((slot) => [slot.slotId, slot.participantId]));

  return (
    <figure className="min-w-0 overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
      <figcaption className={cn(
        "flex min-w-0 items-center justify-between gap-3 border-b px-3 py-3",
        side === "A" ? "border-blue-400/30 bg-blue-950/75" : "border-red-400/30 bg-red-950/75"
      )}>
        <span className="min-w-0 break-words text-sm font-bold text-white [overflow-wrap:anywhere]">{teamLabel}</span>
        <span className="shrink-0 rounded-md bg-black/25 px-2 py-1 text-xs font-semibold tabular-nums text-white/90">
          {formation.formationId}
        </span>
      </figcaption>
      <div
        aria-label={`Cancha de ${teamLabel}`}
        className="relative isolate aspect-[4/5] min-h-[480px] w-full overflow-hidden"
        role="group"
        style={{
          backgroundColor: "#176b3a",
          backgroundImage: "repeating-linear-gradient(0deg, transparent 0%, transparent 12.5%, rgba(255,255,255,.045) 12.5%, rgba(255,255,255,.045) 25%), radial-gradient(ellipse at center, #237a43 0%, #105c32 100%)"
        }}
      >
        <PitchLines />
        {positions.map((position) => {
          const participantId = assignedPlayers.get(position.slotId);
          const player = participantId ? playersById.get(participantId) : undefined;
          const lineSize = positions.filter((item) => item.y === position.y).length;
          const label = `${position.label}: ${player?.name ?? "Elegir jugador"}`;
          const className = cn(
            "absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 text-center",
            onSelectSlot ? "cursor-pointer transition hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" : "",
            onSelectSlot && selectedSlotId === position.slotId ? "bg-white/15 ring-2 ring-white" : ""
          );
          const style = { left: `${position.x}%`, top: `${position.y}%`, width: `${Math.min(32, 86 / lineSize)}%` };
          const content = (
            <>
              <Shirt isGoalkeeper={position.slotId === "gk"} side={side} />
              <span className="line-clamp-2 w-full rounded bg-slate-950/85 px-1 py-0.5 text-[10px] font-semibold leading-[13px] text-white [overflow-wrap:anywhere] sm:text-xs sm:leading-4" title={player?.name}>
                {player?.name ?? "Elegir"}
              </span>
            </>
          );

          return onSelectSlot ? (
            <button
              aria-label={label}
              aria-controls={controlsId}
              aria-pressed={selectedSlotId === position.slotId}
              className={className}
              key={position.slotId}
              onClick={() => onSelectSlot(position.slotId)}
              style={style}
              type="button"
            >
              {content}
            </button>
          ) : (
            <div aria-label={label} className={className} key={position.slotId} role="img" style={style}>
              {content}
            </div>
          );
        })}
      </div>
    </figure>
  );
}
