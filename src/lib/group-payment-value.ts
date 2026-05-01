export type GroupPaymentValueStage = "setup" | "first_match" | "proven";
export type GroupPaymentAccessTone = "paid" | "trial" | "trial_ending" | "locked";

export type GroupPaymentValueInput = {
  accessValidUntil: string | null;
  canWrite: boolean;
  finishedCount: number;
  now?: Date;
  playersCount: number;
  subscriptionActive: boolean;
  totalMatches: number;
};

export type GroupPaymentValueState = {
  accessDescription: string;
  accessTone: GroupPaymentAccessTone;
  daysLeft: number | null;
  description: string;
  headline: string;
  stage: GroupPaymentValueStage;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function getDaysUntilAccessEnds(accessValidUntil: string | null, now = new Date()) {
  if (!accessValidUntil) return null;
  const end = new Date(accessValidUntil);
  if (Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
}

function getStage(params: Pick<GroupPaymentValueInput, "finishedCount" | "playersCount" | "totalMatches">) {
  if (params.finishedCount > 0) return "proven";
  if (params.playersCount > 0 || params.totalMatches > 0) return "first_match";
  return "setup";
}

function getStageCopy(stage: GroupPaymentValueStage) {
  switch (stage) {
    case "proven":
      return {
        headline: "Tu grupo ya tiene valor acumulado",
        description:
          "Ya hay resultados que alimentan ranking, historial y rendimiento. El plan mensual mantiene abierta la edicion para que ese trabajo no se corte."
      };
    case "first_match":
      return {
        headline: "Tu grupo ya empezo a tomar forma",
        description:
          "El siguiente salto es cerrar resultados y compartir ranking. Cuando el grupo lo usa, pagar el plan conserva la operacion semanal."
      };
    case "setup":
      return {
        headline: "Deja listo el grupo antes del proximo partido",
        description:
          "Carga jugadores, arma el primer partido y comparti el ranking. La prueba gratis sirve para llegar a ese primer valor sin friccion."
      };
  }
}

function getAccessTone(input: GroupPaymentValueInput, daysLeft: number | null): GroupPaymentAccessTone {
  if (!input.canWrite) return "locked";
  if (input.subscriptionActive) return "paid";
  if (daysLeft !== null && daysLeft <= 7) return "trial_ending";
  return "trial";
}

function getAccessDescription(tone: GroupPaymentAccessTone, daysLeft: number | null) {
  switch (tone) {
    case "paid":
      return daysLeft !== null
        ? `Plan activo. Quedan ${daysLeft} dias de edicion en el periodo actual.`
        : "Plan activo. La edicion del grupo esta habilitada.";
    case "trial_ending":
      return daysLeft === 0
        ? "La prueba vence hoy. Activa el plan para seguir creando partidos y cargando resultados."
        : `Quedan ${daysLeft} dias de prueba. Activa el plan para no cortar la edicion.`;
    case "locked":
      return "El grupo esta en modo lectura. Reactiva el plan para volver a crear partidos y cargar resultados.";
    case "trial":
      return daysLeft !== null
        ? `Prueba gratis activa. Quedan ${daysLeft} dias para validar el valor del grupo.`
        : "Prueba gratis activa. Usa este periodo para cargar el primer partido y compartir ranking.";
  }
}

export function buildGroupPaymentValueState(input: GroupPaymentValueInput): GroupPaymentValueState {
  const stage = getStage(input);
  const stageCopy = getStageCopy(stage);
  const daysLeft = getDaysUntilAccessEnds(input.accessValidUntil, input.now);
  const accessTone = getAccessTone(input, daysLeft);

  return {
    accessDescription: getAccessDescription(accessTone, daysLeft),
    accessTone,
    daysLeft,
    description: stageCopy.description,
    headline: stageCopy.headline,
    stage
  };
}
