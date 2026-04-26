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
    eyebrow: "Ayuda para Grupos",
    title: "Todo lo que necesitas para organizar partidos entre amigos",
    description:
      "Grupos esta pensado para el futbol de todos los dias: cargas jugadores, defines niveles, armas partidos parejos, guardas resultados y dejas ranking e historial listos para consultar.",
    capabilities: [
      "Crear y administrar uno o varios grupos desde la misma cuenta.",
      "Cargar jugadores con nivel de habilidad simple, repetible y editable.",
      "Generar equipos equilibrados usando nivel, rendimiento, invitados y arqueros.",
      "Publicar ranking, historial y proximos partidos para que cualquiera pueda verlos."
    ],
    focusTitle: "Que conviene hacer primero",
    focusDescription:
      "Carga el plantel base, asigna niveles con sentido comun y empieza a registrar resultados. Al principio el nivel ayuda a equilibrar; con el tiempo, el rendimiento vuelve el ranking cada vez mas representativo.",
    gettingStartedLabel: "Primeros pasos",
    gettingStarted: [
      {
        title: "1. Crea tu grupo",
        description:
          "Desde el panel admin creas el grupo y cargas una imagen representativa. Si ya tienes uno, la opcion para crear otro queda en una pantalla aparte para no invadir tu flujo diario."
      },
      {
        title: "2. Carga jugadores y niveles",
        description:
          "El nivel va del 1 al 5. Nivel 1 es el mas fuerte. Varios jugadores pueden tener el mismo nivel, porque la habilidad real no siempre entra en una lista unica."
      },
      {
        title: "3. Arma el partido",
        description:
          "Elige modalidad, fecha, convocados, invitados y arqueros. La app propone equipos balanceados para que el admin elija la opcion que mejor calza con la cancha."
      },
      {
        title: "4. Carga el resultado",
        description:
          "Al cerrar el partido, el rendimiento se actualiza y el historial queda guardado. El grupo puede ver ranking, detalle del partido y evolucion sin pedirle nada al admin."
      }
    ],
    workflowLabel: "Como se usa semana a semana",
    workflow: [
      {
        title: "Convocatoria real",
        description:
          "Solo entran al armado los jugadores disponibles para esa fecha. Si aparece un invitado, puedes asignarle un nivel equivalente sin cargarlo como jugador fijo."
      },
      {
        title: "Balance automatico",
        description:
          "El armado mira el nivel base y el rendimiento actual. Si alguien viene rindiendo muy alto, el sistema lo considera mas fuerte para balancear mejor."
      },
      {
        title: "Historial consultable",
        description:
          "Los partidos terminados quedan publicados con marcador, equipos y estadisticas. La informacion se mueve poco y esta pensada para consultarse facil."
      }
    ],
    detailLabel: "Nivel, rendimiento y ranking",
    detail: [
      {
        title: "Nivel de habilidad",
        description:
          "Es la referencia manual del admin. Sirve para arrancar y no cambia automaticamente por ganar o perder."
      },
      {
        title: "Rendimiento",
        description:
          "Es el puntaje competitivo que aprende con los resultados. Se muestra como numero entero para que sea facil de leer."
      },
      {
        title: "Ranking publico",
        description:
          "El ranking se ordena principalmente por rendimiento. El nivel puede ayudar como contexto, pero no reemplaza lo que muestran los partidos."
      },
      {
        title: "Emparejamiento",
        description:
          "Para crear equipos, la app calcula una fuerza efectiva combinando nivel y rendimiento. Ese calculo queda por detras para no complicar al usuario."
      }
    ],
    highlightCards: [
      {
        title: "Lo que ve el visitante",
        description:
          "Ranking, jugadores, historial y proximos partidos. No necesita iniciar sesion para consultar la informacion publica del grupo."
      },
      {
        title: "Lo que controla el admin",
        description:
          "Jugadores, niveles, partidos, resultados, imagen del grupo, admins invitados y facturacion."
      }
    ],
    faq: [
      {
        question: "Puedo tener dos jugadores con el mismo nivel?",
        answer:
          "Si. Esa es la idea: el nivel representa una categoria de habilidad, no una posicion unica dentro del grupo."
      },
      {
        question: "El nivel cambia solo?",
        answer:
          "No. El nivel lo edita el admin. Lo que cambia con cada resultado es el rendimiento competitivo."
      },
      {
        question: "Que pasa si no pago?",
        answer:
          "El grupo queda en modo lectura hasta reactivar el plan. La informacion deportiva se conserva y las fotos de jugadores tienen una ventana de retencion."
      },
      {
        question: "Cuantos admins puede tener un grupo?",
        answer:
          "Hasta 4 administradores activos o pendientes de invitacion por grupo."
      },
      {
        question: "Donde pido ayuda?",
        answer:
          "Desde Contacto puedes escribirnos por formulario o mail. Tambien puedes mandar sugerencias de producto."
      }
    ]
  },
  tournaments: {
    eyebrow: "Ayuda para Torneos",
    title: "Como administrar ligas y competencias sin mezclarlo con Grupos",
    description:
      "Torneos esta pensado para organizadores: una liga contiene equipos maestros, admins y una o varias competencias publicas con fixture, tabla, resultados y estadisticas.",
    capabilities: [
      "Crear una liga como contenedor principal.",
      "Cargar equipos maestros y reutilizarlos en distintas competencias.",
      "Crear competencias publicas para que visitantes consulten la informacion.",
      "Elegir fixture automatico o manual, con capitanes opcionales por equipo."
    ],
    focusTitle: "Que conviene hacer primero",
    focusDescription:
      "Primero crea la liga, carga los equipos maestros y define si vas a usar capitanes. Despues crea las competencias necesarias e inscribe solo los equipos que participan en cada una.",
    gettingStartedLabel: "Primeros pasos",
    gettingStarted: [
      {
        title: "1. Crea la liga",
        description:
          "La liga guarda nombre, logo, foto publica, sede, admins y facturacion. Crear nuevas competencias dentro de esa liga no dispara un checkout nuevo."
      },
      {
        title: "2. Carga equipos maestros",
        description:
          "El catalogo de equipos vive en la liga. Luego eliges cuales se inscriben en cada competencia."
      },
      {
        title: "3. Crea una competencia",
        description:
          "La competencia define formato, temporada, cobertura de datos y equipos inscriptos. Todas las competencias quedan publicas por defecto."
      },
      {
        title: "4. Gestiona fixture y resultados",
        description:
          "Puedes generar fechas automaticamente o cargar cruces manuales. Luego registras resultados y, si corresponde, estadisticas del acta."
      }
    ],
    workflowLabel: "Como se opera una competencia",
    workflow: [
      {
        title: "Competencias claras",
        description:
          "En el admin se listan primero las competencias activas. La creacion queda en una pantalla aparte para no ocupar espacio cuando ya estas trabajando."
      },
      {
        title: "Visibilidad para visitantes",
        description:
          "La informacion publica aparece cuando la liga y la competencia estan activas o finalizadas. Asi quien no esta logueado puede consultar tabla, fixture y resultados."
      },
      {
        title: "Capitanes opcionales",
        description:
          "Puedes invitar capitanes para completar planteles y fotos, o manejar todo desde el equipo admin de la liga."
      }
    ],
    detailLabel: "Tabla, fixture y estadisticas",
    detail: [
      {
        title: "Tabla de posiciones",
        description:
          "Se calcula automaticamente con puntos, diferencia de gol, goles a favor y desempates consistentes."
      },
      {
        title: "Fixture",
        description:
          "Round robin, copa o liga mas copa. Si hay cantidad impar, se contempla fecha libre o pase de ronda cuando corresponde."
      },
      {
        title: "Resultados",
        description:
          "Puedes cerrar un partido solo con marcador. Si quieres mas detalle, agregas goles, figuras y tarjetas."
      },
      {
        title: "Competencias publicas",
        description:
          "No hay checkbox para ocultarlas. Si la competencia no debe verse todavia, usa estado draft; si ya termino, usa finished."
      }
    ],
    highlightCards: [
      {
        title: "Liga no es competencia",
        description:
          "La liga es el contenedor. La competencia es lo que se juega. Esto permite tener Viernes A, Viernes B o Copa dentro de la misma liga."
      },
      {
        title: "Que ve el publico",
        description:
          "Listado de ligas, ficha publica, competencias activas, tabla, fixture, detalle de partidos y estadisticas cargadas."
      }
    ],
    faq: [
      {
        question: "Crear una competencia nueva cobra otro mes?",
        answer:
          "No. La facturacion de Torneos esta asociada al alta de la liga. Dentro de una liga puedes crear las competencias que necesites."
      },
      {
        question: "Puedo ocultar una competencia?",
        answer:
          "La competencia es publica por defecto. Para que no aparezca publicamente, mantenla en draft o archiva lo que ya no corresponda mostrar."
      },
      {
        question: "Los torneos usan los mismos jugadores que Grupos?",
        answer:
          "No. Son flujos separados para no mezclar historial, planteles ni permisos."
      },
      {
        question: "Cuantos admins puede tener una liga?",
        answer:
          "Hasta 4 administradores por liga."
      },
      {
        question: "Que puede hacer un capitan?",
        answer:
          "Solo accede al equipo que el admin le asigno dentro de la competencia. Puede completar plantel y fotos, pero no administra la liga."
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
          <CardTitle>Que puedes hacer</CardTitle>
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
