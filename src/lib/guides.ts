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
      "Armá equipos parejos de fútbol 5, 7 u 11 con una referencia de nivel, arqueros y convocados. Incluye un ejemplo práctico y cómo repetir el proceso gratis.",
    readingTime: "4 min",
    sections: [
      {
        title: "Confirmá cuántos juegan y quiénes van al arco",
        body: [
          "Antes de sortear equipos, cerrá la lista de convocados y la modalidad. Para un fútbol 5 necesitás diez participantes; si hay dos arqueros fijos, quedan ocho jugadores de campo para repartir. Si todos rotan al arco, acordá esa rotación antes de empezar.",
          "El armado depende de las personas que realmente van a jugar. Una baja después del sorteo puede cambiar tanto el nivel como los roles: revisá el reemplazo y volvé a compartir la formación si hace falta."
        ]
      },
      {
        title: "Partí de niveles claros",
        body: [
          "La forma más sana de ordenar un grupo amateur es separar nivel real de amistad o antigüedad. Usá categorías amplias, revisalas cada pocas semanas y evitá ajustar por un solo partido bueno o malo.",
          "En Fábrica de Fútbol, la habilidad es una categoría que define el admin: Nivel 1 es Estrella y Nivel 7 es Principiante. Varios jugadores pueden compartir nivel. Los puntos deportivos cambian con los resultados; editar la habilidad no reinicia esos puntos. La categoría Figura es distinta de la figura del partido.",
          "Si hay arqueros fijos, tratá ese rol como una variable propia. Un equipo con mejor arquero suele necesitar menos ventaja de campo que uno con jugadores de campo más fuertes."
        ]
      },
      {
        title: "Ejemplo para repartir diez jugadores",
        body: [
          "Tomemos un ejemplo ficticio: dos arqueros de nivel similar y ocho jugadores de campo, dos de nivel 2, dos de nivel 3, dos de nivel 4 y dos de nivel 5. Un punto de partida es poner un arquero y un jugador de cada nivel en cada equipo. Así evitás juntar a los dos jugadores más fuertes de entrada.",
          "Después revisá los roles. Si ambos defensores quedaron del mismo lado, intercambiá jugadores de nivel parecido para que cada equipo tenga alguien que cubra atrás. Hacé lo mismo con quienes suelen atacar. Compartir una categoría no significa jugar de la misma manera.",
          "Este ejemplo es un criterio inicial, no una garantía de empate ni una descripción del algoritmo de la app. La química, el estado físico y lo que pasa durante el partido también influyen."
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
      },
      {
        title: "Armá y compartí los equipos en Fábrica de Fútbol",
        body: [
          "Creá tu grupo gratis, cargá los jugadores y definí su habilidad inicial. Los jugadores no necesitan registrarse. Al preparar el partido, elegí a los convocados y arqueros para que la app proponga opciones de equipos.",
          "Revisá la opción elegida y compartila por WhatsApp. Después del partido, guardá el marcador y la formación que realmente jugó: el ranking y el historial te dan contexto para la próxima fecha. La figura del partido es opcional y no agrega puntos."
        ]
      }
    ]
  },
  {
    slug: "ranking-amateur-justo",
    title: "Cómo hacer un ranking amateur justo",
    description:
      "Cómo interpretar el ranking de tu grupo de fútbol: puntos por resultados, partidos jugados, habilidad inicial y figuras sin puntos extra.",
    readingTime: "3 min",
    sections: [
      {
        title: "Separá habilidad de puntos deportivos",
        body: [
          "En Fábrica de Fútbol, la habilidad es una referencia que define el admin para cada jugador: va de Nivel 1, Estrella, a Nivel 7, Principiante. Los puntos deportivos se actualizan con los resultados. Cambiar la categoría de habilidad no reinicia esos puntos.",
          "Por ejemplo, un invitado puede tener mucha habilidad y poco historial en el grupo. Otro jugador puede acumular muchos partidos y una racha reciente floja. Mirar ambas referencias ayuda a interpretar la tabla sin convertir una posición en un juicio definitivo sobre cómo juega alguien."
        ]
      },
      {
        title: "Medí continuidad y resultado",
        body: [
          "Para leer un ranking, mirá los puntos junto con los partidos jugados y el historial. Dos jugadores en posiciones cercanas pueden haber participado en cantidades muy distintas de encuentros.",
          "Si alguien acaba de entrar al grupo, hay menos información para sacar conclusiones. Antes de cambiar su referencia de habilidad, observá varios partidos y tené en cuenta su rol, lesiones o una vuelta después de mucho tiempo."
        ]
      },
      {
        title: "La figura reconoce el partido sin sumar puntos",
        body: [
          "La figura del partido, también llamada MVP, es opcional y simbólica: no agrega puntos al ranking. Si dos jugadores tienen los mismos puntos, desempata la cantidad de figuras de la temporada seleccionada; la opción Todo usa el conteo histórico.",
          "Elegir una figura o corregir esa distinción después no modifica los puntos globales ni de temporada. Separá esa decisión del marcador para que el grupo entienda qué representa cada dato. La categoría de habilidad llamada Figura también es distinta de esta distinción."
        ]
      },
      {
        title: "Guardá lo que pasó en cancha",
        body: [
          "Al cargar el resultado, verificá el marcador y quiénes jugaron en cada equipo. Si hubo una ausencia, un invitado o un reemplazo, ajustá la formación final antes de guardar el acta. Un historial que refleja el partido real es la base para interpretar la evolución de los puntos.",
          "Una ausencia no debería resolverse por intuición a la semana siguiente. Acordá la regla del grupo y registrá cada caso con criterio consistente. También podés agregar una nota para recordar contexto que la tabla sola no explica."
        ]
      },
      {
        title: "Usá el ranking como herramienta, no como sentencia",
        body: [
          "El ranking ayuda a armar equipos y recordar temporadas, pero el admin siempre puede aplicar criterio cuando falta contexto.",
          "Una buena práctica es revisar manualmente casos raros: lesiones largas, jugadores nuevos, invitados frecuentes o cambios de posición."
        ]
      },
      {
        title: "Compará la temporada y el historial completo",
        body: [
          "Usá la temporada seleccionada cuando quieras ver cómo viene el grupo durante ese año deportivo. Consultá Todo para el recorrido histórico. Antes de comparar dos posiciones, asegurate de que estás mirando el mismo período.",
          "Compartí el link del grupo para que los jugadores puedan consultar resultados y ranking sin registrarse. Mostrar de dónde salen los datos ayuda a conversar sobre un partido concreto en lugar de discutir desde la memoria."
        ]
      }
    ]
  },
  {
    slug: "organizar-futbol-semanal",
    title: "Guía para organizar fútbol semanal sin caos",
    description:
      "Organizá el fútbol semanal con amigos: horarios de confirmación, suplentes, equipos parejos y un mensaje de WhatsApp de ejemplo para compartir el partido.",
    readingTime: "3 min",
    sections: [
      {
        title: "Definí una cadencia",
        body: [
          "Elegí un día fijo para abrir convocatoria y otro momento para cerrar confirmados. La previsibilidad reduce cambios de último minuto.",
          "Si el grupo tiene cupos limitados, dejá claro cómo entran suplentes e invitados. Lo peor para un admin es decidir eso a las apuradas."
        ]
      },
      {
        title: "Una rutina concreta para el partido del jueves",
        body: [
          "Como ejemplo de organización, podés abrir la lista el lunes, cerrar confirmados el miércoles a las 20 y compartir los equipos el jueves cuando el cupo esté completo. Son horarios de ejemplo: elegí los que sirvan para tu cancha y tu grupo.",
          "Definí quién confirma la reserva, quién organiza la lista y quién carga el resultado. Si todo queda en una sola persona, acordá un reemplazo para los días en que no pueda ocuparse. No hace falta sumar tareas: alcanza con que cada paso tenga un responsable."
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
        title: "Compartí un mensaje de WhatsApp fácil de encontrar",
        body: [
          "Un ejemplo ficticio para copiar y adaptar: «Fútbol 5 · jueves a las 21 · Cancha del barrio. Confirmados: 10. Suplentes: Nico y Agus. Equipos: ver link del grupo. Si te bajás, avisá antes de las 18 y etiquetá al admin». Completá la dirección real y el costo de la cancha si corresponde.",
          "Usá un mensaje final con fecha, hora, lugar y link, y fijalo en el chat si el grupo lo necesita. En Fábrica de Fútbol podés compartir el armado por WhatsApp y dejar el ranking y el historial disponibles en el link público del grupo; los jugadores no tienen que crear una cuenta."
        ]
      },
      {
        title: "Cerrá el resultado el mismo día",
        body: [
          "Cargar el resultado apenas termina el partido mantiene vivo el ranking y evita depender de la memoria. Antes de guardarlo, verificá el marcador y la formación final, especialmente si hubo bajas, invitados o cambios de equipo.",
          "No necesitás elegir una figura para completar el partido: esa distinción es opcional y no suma puntos. Si querés recordar una lesión, un cambio de arquero o una situación particular, agregá una nota en el acta."
        ]
      },
      {
        title: "Repetí el proceso sin empezar de cero",
        body: [
          "Creá tu grupo gratis una vez y cargá a los jugadores habituales con su habilidad inicial. Para cada fecha, trabajá con los convocados de ese partido, revisá arqueros y elegí una propuesta de equipos. La lista estable te evita volver a describir a cada jugador en el chat.",
          "Después de varias fechas, revisá si los horarios de corte funcionan y si siempre faltan suplentes o arqueros. Ajustá esa rutina con el grupo. El objetivo es llegar a la cancha con la organización resuelta y conservar el resultado para la próxima semana."
        ]
      }
    ]
  },
  {
    slug: "historial-partidos-grupo",
    title: "Por qué conviene guardar el historial de partidos",
    description:
      "El historial evita discusiones, mejora el armado de equipos y le da identidad al grupo con datos propios.",
    readingTime: "1 min",
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
    readingTime: "1 min",
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
    readingTime: "1 min",
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
    title: "Cómo elegir la figura del partido o MVP entre amigos",
    description:
      "Elegí la figura del partido con un criterio claro y un ejemplo práctico. En Fábrica de Fútbol el MVP es opcional, no suma puntos y sirve para desempatar.",
    readingTime: "2 min",
    sections: [
      {
        title: "Acordá qué significa MVP",
        body: [
          "Para algunos grupos el MVP es quien jugó mejor; para otros, quien fue decisivo. Si no se aclara, cada voto mide algo distinto.",
          "Una definición simple alcanza: impacto en el resultado, regularidad durante el partido y aporte al equipo."
        ]
      },
      {
        title: "Elegí con un criterio que todos conozcan",
        body: [
          "Una opción es que el grupo proponga candidatos al terminar y que el admin registre la elección acordada en el acta. Otra es dejar la decisión en una persona que haya visto todo el partido. Lo importante es definir el método antes de conocer a los candidatos.",
          "Por ejemplo, en un partido ficticio alguien hizo dos goles y el arquero evitó varias situaciones claras. Si el criterio es aporte al equipo durante todo el encuentro, ambos pueden ser candidatos: mirá también las asistencias, la recuperación de la pelota y la regularidad, en vez de decidir sólo por el último gol.",
          "Esto es una propuesta para conversar entre amigos, no una votación automática de la app. Fábrica de Fútbol permite al admin guardar la figura elegida; la decisión sigue siendo del grupo."
        ]
      },
      {
        title: "No lo uses para castigar",
        body: [
          "En Fábrica de Fútbol, la figura del partido (MVP) es opcional y simbólica: no suma puntos. Cuando dos jugadores tienen los mismos puntos, desempata la cantidad de figuras de la temporada elegida. La opción Todo usa el conteo histórico. Cambiar solamente la figura no altera los puntos globales ni de temporada.",
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
      "Ordená el año deportivo de tu grupo, compará el ranking por temporada y reconocé constancia sin perder el historial de partidos.",
    readingTime: "2 min",
    sections: [
      {
        title: "Usá el año deportivo como referencia",
        body: [
          "En Fábrica de Fútbol, las temporadas siguen el año deportivo de cada partido y el cambio anual toma la hora de Buenos Aires. Seleccioná una temporada para consultar ese período o elegí Todo para ver el historial completo.",
          "El grupo puede hacer balances mensuales o a mitad de año como una costumbre propia. Esos encuentros no cambian el corte anual de las temporadas de la app: sirven para conversar sobre cómo viene el grupo."
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
          "Empezar un nuevo año deportivo no implica borrar los partidos anteriores. El historial viejo sigue sirviendo para comparar etapas y ver cómo cambió el grupo; los puntos históricos se consultan con Todo.",
          "Antes de arrancar otra etapa, revisá la habilidad de los jugadores, quiénes ya no participan e invitados que necesitan una referencia propia. Editar la habilidad no reinicia los puntos deportivos."
        ]
      }
    ]
  },
  {
    slug: "cargar-resultados-ausencias-reemplazos",
    title: "Cómo cargar resultados, ausencias y reemplazos",
    description:
      "Una guía práctica para cerrar el partido sin ensuciar el ranking: marcador, formación final, invitados, reemplazos y ausencias con criterio.",
    readingTime: "2 min",
    sections: [
      {
        title: "Empezá por el marcador",
        body: [
          "Cargá los goles mirando siempre el enfrentamiento equipo vs equipo. Esto evita invertir el resultado cuando los nombres del equipo cambiaron después del armado.",
          "Si el partido ya estaba confirmado, revisá primero que la opción elegida sea la que finalmente se jugó."
        ]
      },
      {
        title: "Ajustá la formación final",
        body: [
          "La formación final sirve para corregir lo que pasó en cancha: jugadores que cambiaron de equipo, jugadores que no asistieron, reemplazos del grupo e invitados.",
          "No hace falta mirar todo el listado cada vez. Abrilo sólo cuando hubo cambios contra el armado confirmado."
        ]
      },
      {
        title: "Penalizá ausencias sólo si corresponde",
        body: [
          "Marcar a alguien como no asistió no descuenta rendimiento por sí solo. El admin decide si aplica -20 cuando hubo ausencia sin aviso o una regla interna del grupo.",
          "Usá esa penalización como criterio claro y consistente. Si el jugador avisó bien o el reemplazo quedó resuelto, puede quedar sin descuento."
        ]
      },
      {
        title: "Usá la desventaja numérica con cuidado",
        body: [
          "La regla de desventaja aplica cuando un equipo jugó con menos participantes. Si ese equipo gana, el ajuste se duplica; si pierde, no se lo castiga extra.",
          "No la uses para diferencias de nivel: para eso ya está el rendimiento y el armado de equipos."
        ]
      }
    ]
  }
];

export function getGuideBySlug(slug: string) {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}
