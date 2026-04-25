import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { PublicModuleToggle } from "@/components/layout/public-module-toggle";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { type PublicModuleContext, resolvePublicModule, withPublicQuery } from "@/lib/org";

type HelpSectionItem = {
  title: string;
  description: string;
};

type HelpFaqItem = {
  question: string;
  answer: string;
};

type HelpContent = {
  eyebrow: string;
  title: string;
  description: string;
  capabilities: string[];
  focusTitle: string;
  focusDescription: string;
  gettingStartedLabel: string;
  gettingStarted: HelpSectionItem[];
  workflowLabel: string;
  workflow: HelpSectionItem[];
  detailLabel: string;
  detail: HelpSectionItem[];
  highlightCards: HelpSectionItem[];
  faq: HelpFaqItem[];
};

const helpContentByModule: Record<PublicModuleContext, HelpContent> = {
  organizations: {
    eyebrow: "Centro de ayuda",
    title: "Como funciona el modulo Grupos",
    description:
      "Grupos esta pensado para grupos de futbol amateur que quieren ordenar su plantel, convocar jugadores, generar equipos balanceados, registrar resultados y mantener un ranking competitivo actualizado.",
    capabilities: [
      "Administrar uno o varios grupos desde la misma cuenta.",
      "Cargar jugadores, ordenar el plantel y sumar invitados puntuales.",
      "Crear partidos, convocar participantes y generar equipos.",
      "Registrar resultados y actualizar automaticamente el ranking."
    ],
    focusTitle: "En que conviene enfocarse al principio",
    focusDescription:
      "Lo ideal es construir primero una buena base de jugadores, luego crear los primeros partidos y finalmente empezar a cargar resultados para que el ranking gane valor con el tiempo.",
    gettingStartedLabel: "Primeros pasos",
    gettingStarted: [
      {
        title: "1. Crea tu cuenta y activa tu grupo",
        description:
          "Ingresa al panel, registrate con tu email y crea el grupo que vas a administrar. Desde ese momento ya puedes empezar a cargar tu plantel y trabajar sobre tus partidos."
      },
      {
        title: "2. Carga tu plantel base",
        description:
          "En la seccion Jugadores agrega a cada integrante del equipo. El nombre es obligatorio y el orden inicial te sirve para ordenar tu plantel desde el primer dia."
      },
      {
        title: "3. Crea tu primer partido",
        description:
          "En Nuevo Partido eliges modalidad, fecha y convocatoria. Puedes trabajar solo con jugadores registrados o sumar invitados puntuales con un rating manual."
      },
      {
        title: "4. Confirma equipos y carga el resultado",
        description:
          "La app genera opciones equilibradas para que elijas una formacion final. Cuando el partido se juega, cargas el resultado y el sistema actualiza automaticamente el ranking competitivo."
      }
    ],
    workflowLabel: "Como se gestiona el dia a dia",
    workflow: [
      {
        title: "Convocatoria clara",
        description:
          "El sistema arma los equipos a partir de la lista de convocados del partido. Eso te permite trabajar con la disponibilidad real de cada fecha."
      },
      {
        title: "Equipos balanceados",
        description:
          "Las opciones automaticas buscan reducir la diferencia entre ambos lados usando como referencia el orden inicial del plantel y el puntaje manual de los invitados."
      },
      {
        title: "Flexibilidad para la cancha real",
        description:
          "Si hubo ausencias, reemplazos o invitados de ultimo momento, puedes ajustar la formacion antes de cargar el resultado final para que el historial quede fiel a lo que paso."
      }
    ],
    detailLabel: "Ranking de jugadores",
    detail: [
      {
        title: "Orden inicial del plantel",
        description:
          "Es una referencia manual definida por el administrador para ordenar a los jugadores dentro del grupo y hoy tambien sirve como base para balancear equipos."
      },
      {
        title: "Punto de partida del rating",
        description:
          "Cada jugador registrado comienza con un rating competitivo de 1000 puntos. Ese valor es dinamico y funciona como base para medir su evolucion."
      },
      {
        title: "Como se actualiza",
        description:
          "Cuando cargas un resultado, una victoria suma 10 puntos a los jugadores del equipo ganador y una derrota resta 10 al equipo que pierde. Si empatan, el rating no se modifica."
      },
      {
        title: "Partidos en inferioridad",
        description:
          "Si un equipo juega con menos jugadores, el ajuste se adapta para no medir igual una desventaja numerica. Una victoria en inferioridad se premia mas."
      }
    ],
    highlightCards: [
      {
        title: "Como interpretar el ranking",
        description:
          "Hay dos referencias distintas dentro de la plataforma: el orden inicial del plantel, que es manual, y el ranking competitivo, que se calcula con el rating actual de cada jugador."
      },
      {
        title: "Consejo practico",
        description:
          "Si el grupo es nuevo o todavia no tiene historial, empieza cargando a todos los jugadores y juega algunos partidos con normalidad. A medida que se sumen resultados, el ranking competitivo va a reflejar mejor la realidad."
      }
    ],
    faq: [
      {
        question: "Que informacion es publica?",
        answer:
          "Los grupos publicos muestran ranking, jugadores, historial de partidos y proximos encuentros. La gestion y edicion quedan reservadas para los administradores."
      },
      {
        question: "Cuantos administradores puede tener un grupo?",
        answer:
          "Cada grupo admite hasta 4 administradores activos o pendientes de invitacion. Eso permite repartir la gestion sin perder control."
      },
      {
        question: "La plataforma tiene costo?",
        answer:
          "El modulo ya esta preparado para facturacion, pero el valor publico final se esta terminando de definir. En Precios veras el esquema placeholder con XXX mientras cerramos ese dato."
      },
      {
        question: "Que pasa cuando termina el periodo contratado?",
        answer:
          "La idea es mantener la informacion visible y dejar el grupo en modo lectura hasta reactivar el plan. Esa politica comercial fina tambien se mostrara en la pagina de precios."
      },
      {
        question: "Donde puedo hacer consultas o reportar un problema?",
        answer:
          "En la seccion Contacto puedes enviar sugerencias, consultas o reportes de error para que el equipo los revise."
      }
    ]
  },
  tournaments: {
    eyebrow: "Centro de ayuda",
    title: "Como funciona el modulo Torneos",
    description:
      "Torneos esta pensado para ligas y competencias. Permite cargar equipos maestros en la liga, inscribirlos en cada competencia, definir admins, elegir si usas capitanes, armar fixture y publicar tabla y estadisticas.",
    capabilities: [
      "Crear varias competencias dentro de una misma liga, separadas del modulo Grupos.",
      "Cargar equipos maestros en la liga y planteles propios dentro de cada competencia.",
      "Definir hasta 4 administradores por liga.",
      "Elegir entre fixture automatico o armado manual fecha por fecha."
    ],
    focusTitle: "En que conviene enfocarse al principio",
    focusDescription:
      "Primero conviene crear la liga, cargar los equipos maestros y dejar claras las responsabilidades. Despues puedes definir cada competencia, decidir si usaras capitanes o si toda la carga quedara en admins, y avanzar con el fixture para ordenar la operacion.",
    gettingStartedLabel: "Primeros pasos",
    gettingStarted: [
      {
        title: "1. Crea la liga",
        description:
          "Desde el panel de Torneos cargas el nombre de la liga y arrancas el alta desde Mercado Pago. Despues, dentro de esa liga, puedes crear competencias como Viernes A, Viernes B o Clausura."
      },
      {
        title: "2. Carga los equipos maestros",
        description:
          "Agrega los equipos participantes con nombre, nombre corto y notas. Ese catalogo queda disponible para inscribir los equipos que correspondan en cada competencia."
      },
      {
        title: "3. Crea una competencia e inscribe los equipos",
        description:
          "Cada competencia toma un subconjunto de equipos de la liga. Asi puedes reutilizar el mismo equipo maestro en distintas competencias sin duplicar la base."
      },
      {
        title: "4. Invita capitanes o carga el plantel tu mismo",
        description:
          "Puedes asignar un capitan por equipo inscripto para que complete jugadores y fotos, pero es opcional. Si prefieres, todo el plantel puede quedar administrado solo por el equipo admin de la liga."
      },
      {
        title: "5. Genera el fixture y publica la competencia",
        description:
          "Cuando ya tienes al menos dos equipos, puedes crear el fixture tipo round robin o armarlo manualmente fecha por fecha con horario, sede y cruces definidos por ti."
      }
    ],
    workflowLabel: "Como se gestiona el dia a dia",
    workflow: [
      {
        title: "Fixture flexible",
        description:
          "Puedes generar todas las fechas en forma automatica o armar y editar el fixture manualmente partido por partido para ajustar cruces, horarios, sedes y estados."
      },
      {
        title: "Capitanes con acceso acotado",
        description:
          "Si decides usar capitanes, cada uno solo ve su equipo dentro del torneo y puede completar jugadores y fotos sin tocar la configuracion general de la competencia."
      },
      {
        title: "Carga de actas simple",
        description:
          "En cada partido puedes registrar marcador, figura, goles y tarjetas. Si falta un jugador en el plantel, el acta permite cargar nombre libre para no frenar la carga."
      }
    ],
    detailLabel: "Tabla y estadisticas",
    detail: [
      {
        title: "Tabla de posiciones",
        description:
          "La tabla se calcula automaticamente con 3 puntos por victoria, 1 por empate y 0 por derrota. Los desempates usan diferencia de gol, goles a favor y nombre del equipo."
      },
      {
        title: "Goleadores y figuras",
        description:
          "Los leaderboards se construyen a partir de las actas cargadas. No necesitas mantener tablas manuales de goleadores ni MVPs."
      },
      {
        title: "Vallas menos vencidas",
        description:
          "En esta primera version se muestran por equipo, calculando los goles recibidos por cada club a lo largo del torneo."
      },
      {
        title: "Partidos jugados",
        description:
          "Una vez que un partido queda como jugado, se bloquean los cambios estructurales de equipos o localia. A partir de ahi solo editas el acta y los datos del resultado."
      }
    ],
    highlightCards: [
      {
        title: "Que se publica",
        description:
          "El publico puede ver listado de torneos, tabla, fixture, detalle de partidos, goleadores, figuras y vallas menos vencidas cuando el torneo esta marcado como publico."
      },
      {
        title: "Consejo practico",
        description:
          "Si vas a trabajar con capitanes, define los equipos primero y enviales la invitacion antes de empezar a cargar resultados. Si no, puedes resolver todo desde admins y simplificar el arranque."
      }
    ],
    faq: [
      {
        question: "Los torneos usan los mismos jugadores que grupos?",
        answer:
          "No. El modulo Torneos tiene su propia tabla de jugadores para mantener completamente separado ese dominio del flujo actual de grupos."
      },
      {
        question: "Que puede hacer un capitan?",
        answer:
          "El capitan inicia sesion con su cuenta y solo accede al equipo que el admin le asigno dentro del torneo. Desde ahi puede cargar o editar jugadores y sus fotos, pero usar capitanes es opcional."
      },
      {
        question: "Se puede regenerar el fixture despues de empezarlo?",
        answer:
          "En V1 no. El fixture automatico solo se genera cuando todavia no existen partidos. Una vez creado, los ajustes pasan a ser manuales."
      },
      {
        question: "La plataforma tiene costo?",
        answer:
          "Si. El pack Torneos se inicia desde Mercado Pago y su referencia comercial publica esta en la seccion Precios."
      },
      {
        question: "Cuantos admins puede tener un torneo?",
        answer:
          "Cada liga puede tener hasta 4 administradores. Asi puedes repartir la gestion sin perder control de la estructura general y sus competencias."
      },
      {
        question: "Que pasa si falta un jugador en el plantel al cargar un partido?",
        answer:
          "El acta permite registrar estadisticas con nombre libre sin exigir que ese jugador exista previamente en el plantel, asi no se rompe el flujo operativo."
      }
    ]
  }
};

export default async function HelpPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const currentModule = resolvePublicModule(resolvedSearchParams.module);
  const content = helpContentByModule[currentModule];
  const panelPath =
    currentModule === "tournaments"
      ? withPublicQuery("/admin/tournaments", { organizationKey })
      : withPublicQuery("/admin", { organizationKey });
  const listingPath =
    currentModule === "tournaments"
      ? withPublicQuery("/tournaments", {
          organizationKey,
          module: currentModule
        })
      : withPublicQuery("/groups", {
          organizationKey,
          module: currentModule
        });
  const pricingPath = withPublicQuery("/pricing", {
    organizationKey,
    module: currentModule
  });
  const feedbackPath = withPublicQuery("/feedback", {
    organizationKey,
    module: currentModule
  });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">{content.eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">{content.title}</h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-300 md:text-base">{content.description}</p>
        <PublicModuleToggle
          basePath="/help"
          className="mt-5"
          currentModule={currentModule}
          organizationKey={organizationKey}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)]"
            href={panelPath}
          >
            {currentModule === "tournaments" ? "Ir al panel de torneos" : "Ir al panel de grupos"}
          </Link>
          <Link
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            href={listingPath}
          >
            {currentModule === "tournaments" ? "Ver torneos publicos" : "Ver grupos publicos"}
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href={feedbackPath}
          >
            Contacto
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href={pricingPath}
          >
            Ver precios
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Que puedes hacer en este modulo</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            {content.capabilities.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </Card>
        <Card>
          <CardTitle>{content.focusTitle}</CardTitle>
          <CardDescription className="mt-2">{content.focusDescription}</CardDescription>
        </Card>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{content.gettingStartedLabel}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {content.gettingStarted.map((step) => (
            <Card key={step.title}>
              <CardTitle>{step.title}</CardTitle>
              <CardDescription className="mt-2">{step.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <AdPlaceholder slot="help-top-banner" />

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{content.workflowLabel}</p>
        <div className="grid gap-4 md:grid-cols-3">
          {content.workflow.map((item) => (
            <Card key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription className="mt-2">{item.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{content.detailLabel}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {content.detail.map((item) => (
            <Card key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription className="mt-2">{item.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {content.highlightCards.map((item) => (
          <Card key={item.title}>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription className="mt-2">{item.description}</CardDescription>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Preguntas frecuentes</p>
        <div className="space-y-3">
          {content.faq.map((item) => (
            <Card key={item.question}>
              <CardTitle>{item.question}</CardTitle>
              <CardDescription className="mt-2">{item.answer}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <AdPlaceholder slot="help-bottom-banner" />
    </div>
  );
}
