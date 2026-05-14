export type GroupActivityValueStage = "setup" | "first_match" | "proven";

export type GroupActivityValueInput = {
  finishedCount: number;
  playersCount: number;
  totalMatches: number;
};

export type GroupActivityValueState = {
  description: string;
  headline: string;
  pendingResultsCount: number;
  stage: GroupActivityValueStage;
};

function getStage(params: GroupActivityValueInput): GroupActivityValueStage {
  if (params.finishedCount > 0) return "proven";
  if (params.playersCount > 0 || params.totalMatches > 0) return "first_match";
  return "setup";
}

function getStageCopy(stage: GroupActivityValueStage, pendingResultsCount: number) {
  switch (stage) {
    case "proven":
      return {
        headline: "Estado del grupo",
        description:
          pendingResultsCount > 0
            ? `Faltan ${pendingResultsCount} resultados para que ranking e historial queden al dia.`
            : "Todo al dia: los partidos cargados ya tienen resultado."
      };
    case "first_match":
      return {
        headline: "Estado del grupo",
        description:
          pendingResultsCount > 0
            ? `Faltan ${pendingResultsCount} resultados para activar ranking e historial.`
            : "El grupo ya esta tomando forma. Arma el primer partido y carga el resultado para activar ranking e historial."
      };
    case "setup":
      return {
        headline: "Estado del grupo",
        description:
          "Carga jugadores y arma el primer partido. Cuando haya resultados, esta tarjeta muestra si el grupo esta al dia."
      };
  }
}

export function buildGroupActivityValueState(input: GroupActivityValueInput): GroupActivityValueState {
  const stage = getStage(input);
  const pendingResultsCount = Math.max(input.totalMatches - input.finishedCount, 0);
  const stageCopy = getStageCopy(stage, pendingResultsCount);

  return {
    description: stageCopy.description,
    headline: stageCopy.headline,
    pendingResultsCount,
    stage
  };
}
