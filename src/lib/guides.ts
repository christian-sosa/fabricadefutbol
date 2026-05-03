export type GuideSection = {
  title: string;
  body: string[];
};

export type Guide = {
  slug: string;
  title: string;
  description: string;
  readingTime: string;
  sections: GuideSection[];
};

export const GUIDES: Guide[] = [
  {
    slug: "armar-equipos-parejos-futbol-amateur",
    title: "Cómo armar equipos parejos en fútbol amateur",
    description:
      "Un método simple para mezclar nivel, roles, asistencia y contexto sin transformar el partido en una discusión eterna.",
    readingTime: "5 min",
    sections: [
      {
        title: "Partí de niveles claros",
        body: [
          "La forma más sana de ordenar un grupo amateur es separar nivel real de amistad o antigüedad. Usá categorías amplias, revisalas cada pocas semanas y evitá ajustar por un solo partido bueno o malo.",
          "Si hay arqueros fijos, tratá ese rol como una variable propia. Un equipo con mejor arquero suele necesitar menos ventaja de campo que uno con jugadores de campo más fuertes."
        ]
      },
      {
        title: "Balanceá rendimiento reciente",
        body: [
          "El nivel inicial sirve para arrancar, pero el rendimiento reciente ayuda a detectar jugadores que están subiendo, bajando o volviendo de una pausa.",
          "La regla práctica: no busques equipos perfectos, buscá equipos defendibles. Si podés explicar por qué quedaron así, el grupo acepta mejor la propuesta."
        ]
      },
      {
        title: "Cuidá la dinámica del grupo",
        body: [
          "Evitá que siempre queden juntos los mismos dos o tres jugadores fuertes. Rotar sociedades hace que el ranking sea más justo y que el partido no dependa de una dupla fija.",
          "Cuando hay invitados, cargalos con una referencia honesta. Si no conocés el nivel, ponelos en una zona media y ajustá después del primer partido."
        ]
      }
    ]
  },
  {
    slug: "ranking-amateur-justo",
    title: "Cómo hacer un ranking amateur justo",
    description:
      "Ideas para que el ranking motive al grupo sin castigar de más al que falta, juega lesionado o cae en un equipo desbalanceado.",
    readingTime: "4 min",
    sections: [
      {
        title: "Medí continuidad y resultado",
        body: [
          "Un ranking útil no debería mirar solo victorias. También conviene mirar partidos jugados, tendencia de rendimiento y participación real.",
          "Si alguien juega poco, su posición debería moverse con más cuidado. Pocos datos exageran cualquier resultado."
        ]
      },
      {
        title: "Evitá premios imposibles",
        body: [
          "Los sistemas que premian demasiado las goleadas o rachas cortas suelen romper el incentivo. En fútbol amateur, el objetivo es que el ranking cuente una historia razonable del grupo.",
          "Mostrá historial y evolución, no solo una tabla fría. Eso baja discusiones porque todos pueden ver de dónde sale cada cambio."
        ]
      },
      {
        title: "Usá el ranking como herramienta, no como sentencia",
        body: [
          "El ranking ayuda a armar equipos y recordar temporadas, pero el admin siempre puede aplicar criterio cuando falta contexto.",
          "Una buena práctica es revisar manualmente casos raros: lesiones largas, jugadores nuevos, invitados frecuentes o cambios de posición."
        ]
      }
    ]
  },
  {
    slug: "organizar-futbol-semanal",
    title: "Guía para organizar fútbol semanal sin caos",
    description:
      "Checklist para pasar de mensajes sueltos a una rutina clara: convocatoria, confirmados, equipos, resultado e historial.",
    readingTime: "6 min",
    sections: [
      {
        title: "Definí una cadencia",
        body: [
          "Elegí un día fijo para abrir convocatoria y otro momento para cerrar confirmados. La previsibilidad reduce cambios de último minuto.",
          "Si el grupo tiene cupos limitados, dejá claro cómo entran suplentes e invitados. Lo peor para un admin es decidir eso a las apuradas."
        ]
      },
      {
        title: "Separá confirmación de equipo",
        body: [
          "Primero cerrá quiénes juegan. Después armá equipos. Mezclar las dos cosas genera rearmados constantes y discusiones innecesarias.",
          "Cuando alguien se baja tarde, reemplazalo por un jugador de nivel parecido antes de rehacer todo el partido."
        ]
      },
      {
        title: "Cerrá el resultado el mismo día",
        body: [
          "Cargar el resultado apenas termina el partido mantiene vivo el ranking y evita depender de la memoria.",
          "Si no tenés estadísticas completas, cerrá igual el marcador. El historial básico vale más que esperar una carga perfecta que nunca llega."
        ]
      }
    ]
  },
  {
    slug: "historial-partidos-grupo",
    title: "Por qué conviene guardar el historial de partidos",
    description:
      "El historial evita discusiones, mejora el armado de equipos y le da identidad al grupo con datos propios.",
    readingTime: "4 min",
    sections: [
      {
        title: "La memoria del grupo falla",
        body: [
          "Después de varias semanas, casi nadie recuerda resultados, equipos o rachas con precisión. Guardar el historial convierte anécdotas en datos consultables.",
          "Ese registro también ayuda a nuevos jugadores a entender cómo se mueve el grupo y qué nivel se espera."
        ]
      },
      {
        title: "El historial mejora decisiones",
        body: [
          "Con partidos anteriores podés detectar jugadores que siempre quedan en equipos fuertes, duplas demasiado dominantes o invitados que cambiaron mucho el balance.",
          "También sirve para encontrar tendencias: quién juega seguido, quién mejora, quién volvió después de meses y quién necesita una referencia actualizada."
        ]
      },
      {
        title: "No hace falta cargar todo",
        body: [
          "Para empezar alcanza con fecha, equipos y resultado. Si el grupo quiere, después puede sumar figuras, goles o notas.",
          "La prioridad es sostener el hábito. Un historial básico pero constante vale más que un sistema detallado abandonado a las dos semanas."
        ]
      }
    ]
  }
];

export function getGuideBySlug(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
