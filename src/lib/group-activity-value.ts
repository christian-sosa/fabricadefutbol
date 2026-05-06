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
        headline: "Resumen del grupo",
        description:
          "Jugadores, partidos y resultados en un solo lugar. Estos numeros te ayudan a ver si el grupo esta al dia antes de cargar el proximo partido."
      };
    case "first_match":
      return {
        headline: "Grupo en preparacion",
        description:
          "Ya hay jugadores o partidos cargados. El siguiente paso es cerrar un resultado para que ranking e historial empiecen a mostrarse completos."
      };
    case "setup":
      return {
        headline: "Primeros datos del grupo",
        description:
          "Carga jugadores y arma el primer partido. Cuando haya resultados, esta tarjeta va a mostrar el estado real del grupo."
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
