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
  },
  {
    slug: "buenas-practicas-admins-futbol",
    title: "Buenas prácticas para admins de fútbol amateur",
    description:
      "Criterios concretos para administrar un grupo sin quemarse: reglas claras, cambios comunicados a tiempo y decisiones consistentes.",
    readingTime: "5 min",
    sections: [
      {
        title: "Escribí pocas reglas, pero útiles",
        body: [
          "Un grupo amateur no necesita un reglamento enorme. Necesita acuerdos simples sobre confirmación, bajas tarde, invitados, pagos de cancha y carga de resultados.",
          "Cuando una regla cambia, avisala antes del partido siguiente. Las decisiones sorpresivas suelen generar más conflicto que la regla en sí."
        ]
      },
      {
        title: "Separá amistad de administración",
        body: [
          "El admin suele conocer a todos, pero el sistema funciona mejor si las decisiones se apoyan en criterios visibles y no en afinidades.",
          "Si un jugador cuestiona equipos, puntajes o cupos, respondé con datos del grupo: asistencia, historial, rol y rendimiento reciente."
        ]
      },
      {
        title: "Delegá sin perder control",
        body: [
          "Sumar otro admin ayuda cuando el grupo crece, pero conviene dar acceso solo a personas que entiendan las reglas del grupo.",
          "Revisá periódicamente quiénes tienen permisos. Si alguien ya no participa, quitá el acceso para evitar cambios accidentales."
        ]
      }
    ]
  },
  {
    slug: "manejar-ausencias-y-suplentes",
    title: "Cómo manejar ausencias y suplentes",
    description:
      "Una guía para resolver bajas de último momento sin romper el balance del partido ni castigar de más a quienes avisan bien.",
    readingTime: "4 min",
    sections: [
      {
        title: "Definí horarios de corte",
        body: [
          "Pedir confirmación sin horario límite vuelve imprevisible la organización. Marcá una hora de cierre y aplicala de forma consistente.",
          "Si alguien avisa tarde muchas veces, no hace falta discutir cada caso: el historial de asistencia permite decidir con menos desgaste."
        ]
      },
      {
        title: "Usá suplentes por perfil",
        body: [
          "El primer suplente disponible no siempre es el mejor reemplazo. Buscá que el nivel, el rol y la posición se parezcan al jugador que se bajó.",
          "Cuando no haya reemplazo equivalente, compensá en el armado de equipos antes de arrancar. Es mejor ajustar temprano que discutir al final."
        ]
      },
      {
        title: "Registrá invitados frecuentes",
        body: [
          "Un invitado que juega seguido deja de ser un desconocido. Conviene cargarlo y darle una referencia para que el balance sea más justo.",
          "Con el tiempo, esos datos también sirven para decidir si merece cupo fijo o si sigue entrando solo cuando falta alguien."
        ]
      }
    ]
  },
  {
    slug: "usar-mvp-sin-discutir",
    title: "Cómo elegir MVP sin discutir cada partido",
    description:
      "Ideas para que la elección del jugador destacado sea divertida, consistente y útil para recordar el partido sin volverse una pelea.",
    readingTime: "4 min",
    sections: [
      {
        title: "Acordá qué significa MVP",
        body: [
          "Para algunos grupos el MVP es quien jugó mejor; para otros, quien fue decisivo. Si no se aclara, cada voto mide algo distinto.",
          "Una definición simple alcanza: impacto en el resultado, regularidad durante el partido y aporte al equipo."
        ]
      },
      {
        title: "No lo uses para castigar",
        body: [
          "El MVP funciona mejor como memoria positiva que como herramienta para señalar errores ajenos.",
          "Si el partido fue muy desparejo, podés dejarlo sin MVP o elegir una mención de esfuerzo. Forzar una figura no siempre agrega valor."
        ]
      },
      {
        title: "Mirá el historial",
        body: [
          "Con el tiempo, los MVP repetidos muestran tendencias: jugadores decisivos, arqueros que sostienen partidos o invitados que cambian el nivel.",
          "Ese historial también ayuda a que el reconocimiento no dependa solo de la memoria del último gol."
        ]
      }
    ]
  },
  {
    slug: "temporadas-futbol-amateur",
    title: "Cómo cerrar temporadas en un grupo amateur",
    description:
      "Una forma simple de ordenar meses de partidos, reconocer constancia y reiniciar objetivos sin perder el historial construido por el grupo.",
    readingTime: "5 min",
    sections: [
      {
        title: "Elegí cortes naturales",
        body: [
          "Una temporada puede durar tres meses, seis meses o todo el año. Lo importante es que el corte tenga sentido para la frecuencia real del grupo.",
          "Si juegan todas las semanas, un trimestre suele dar suficientes datos sin volver eterno el ranking."
        ]
      },
      {
        title: "Reconocé más que al primero",
        body: [
          "El campeón del ranking es importante, pero también podés destacar asistencia, mejora, valla, goleador, fair play o jugador revelación.",
          "Esos reconocimientos hacen que más personas se sientan parte del historial, incluso si no pelean arriba."
        ]
      },
      {
        title: "Reiniciá sin borrar memoria",
        body: [
          "Cerrar una temporada no implica perder datos. El historial viejo sirve para comparar etapas y ver cómo cambió el grupo.",
          "Antes de arrancar otra etapa, revisá niveles iniciales, jugadores inactivos e invitados que ya merecen una referencia propia."
        ]
      }
    ]
  },
  {
    slug: "cargar-resultados-ausencias-reemplazos",
    title: "Como cargar resultados, ausencias y reemplazos",
    description:
      "Una guia practica para cerrar el partido sin ensuciar el ranking: marcador, formacion final, invitados, reemplazos y ausencias con criterio.",
    readingTime: "4 min",
    sections: [
      {
        title: "Empeza por el marcador",
        body: [
          "Carga los goles mirando siempre el enfrentamiento equipo vs equipo. Esto evita invertir el resultado cuando los nombres del equipo cambiaron despues del armado.",
          "Si el partido ya estaba confirmado, revisa primero que la opcion elegida sea la que finalmente se jugo."
        ]
      },
      {
        title: "Ajusta la formacion final",
        body: [
          "La formacion final sirve para corregir lo que paso en cancha: jugadores que cambiaron de equipo, jugadores que no asistieron, reemplazos del pool e invitados.",
          "No hace falta mirar todo el listado cada vez. Abrilo solo cuando hubo cambios contra el armado confirmado."
        ]
      },
      {
        title: "Penaliza ausencias solo si corresponde",
        body: [
          "Marcar a alguien como no asistio no descuenta rendimiento por si solo. El admin decide si aplica -20 cuando hubo ausencia sin aviso o una regla interna del grupo.",
          "Usa esa penalizacion como criterio claro y consistente. Si el jugador aviso bien o el reemplazo quedo resuelto, puede quedar sin descuento."
        ]
      },
      {
        title: "Usa la desventaja numerica con cuidado",
        body: [
          "La regla de desventaja aplica cuando un equipo jugo con menos participantes. Si ese equipo gana, el ajuste se duplica; si pierde, no se lo castiga extra.",
          "No la uses para diferencias de nivel: para eso ya esta el rendimiento y el armado de equipos."
        ]
      }
    ]
  }
];

export function getGuideBySlug(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
