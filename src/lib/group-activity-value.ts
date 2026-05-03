export type GroupActivityValueStage = "setup" | "first_match" | "proven";

export type GroupActivityValueInput = {
  finishedCount: number;
  playersCount: number;
  totalMatches: number;
};

export type GroupActivityValueState = {
  description: string;
  headline: string;
  stage: GroupActivityValueStage;
};

function getStage(params: GroupActivityValueInput): GroupActivityValueStage {
  if (params.finishedCount > 0) return "proven";
  if (params.playersCount > 0 || params.totalMatches > 0) return "first_match";
  return "setup";
}

function getStageCopy(stage: GroupActivityValueStage) {
  switch (stage) {
    case "proven":
      return {
        headline: "Tu grupo ya tiene valor acumulado",
        description:
          "Ya hay resultados que alimentan ranking, historial y rendimiento. Segui cargando partidos para que el grupo conserve su memoria deportiva."
      };
    case "first_match":
      return {
        headline: "Tu grupo ya empezo a tomar forma",
        description:
          "El siguiente salto es cerrar resultados y compartir ranking. Cuando el grupo lo usa cada semana, el historial empieza a ordenar discusiones."
      };
    case "setup":
      return {
        headline: "Deja listo el grupo antes del proximo partido",
        description:
          "Carga jugadores, arma el primer partido y comparti el ranking. El valor aparece cuando el grupo deja de depender solo del chat."
      };
  }
}

export function buildGroupActivityValueState(input: GroupActivityValueInput): GroupActivityValueState {
  const stage = getStage(input);
  const stageCopy = getStageCopy(stage);

  return {
    description: stageCopy.description,
    headline: stageCopy.headline,
    stage
  };
}
