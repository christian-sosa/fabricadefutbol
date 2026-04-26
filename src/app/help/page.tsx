import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { PublicModuleToggle } from "@/components/layout/public-module-toggle";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  ORGANIZATION_BILLING_CURRENCY,
  ORGANIZATION_MONTHLY_PRICE_ARS
} from "@/lib/constants";
import { type PublicModuleContext, resolvePublicModule, withPublicQuery } from "@/lib/org";

type HelpSectionItem = {
  title: string;
  description: string;
};

type HelpFaqItem = {
  question: string;
  answer: string;
};

type HelpProblem = {
  title: string;
  description: string;
  items: string[];
};

type HelpFinalCta = {
  title: string;
  description: string;
};

type HelpContent = {
  eyebrow: string;
  title: string;
  description: string;
  priceDescription?: string;
  primaryCtaLabel: string;
  listingCtaLabel: string;
  capabilitiesLabel: string;
  capabilities: string[];
  focusTitle: string;
  focusDescription: string;
  problem?: HelpProblem;
  gettingStartedLabel: string;
  gettingStarted: HelpSectionItem[];
  workflowLabel: string;
  workflow: HelpSectionItem[];
  detailLabel: string;
  detail: HelpSectionItem[];
  highlightCards: HelpSectionItem[];
  faq: HelpFaqItem[];
  finalCta?: HelpFinalCta;
};

function formatAmountArs(amount: number) {
  return `$${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)} ${ORGANIZATION_BILLING_CURRENCY}`;
}

const groupMonthlyPrice = formatAmountArs(ORGANIZATION_MONTHLY_PRICE_ARS);

const helpContentByModule: Record<PublicModuleContext, HelpContent> = {
  organizations: {
    eyebrow: "Ayuda para Grupos",
    title: "Organizá tu grupo sin discusiones",
    description:
      "Armá partidos parejos, cargá resultados y mantené un ranking real de tu grupo. Fábrica de Fútbol te ayuda a llevar el historial, los jugadores y los próximos partidos en un solo lugar.",
    priceDescription: `Probá 1 mes gratis. Después, ${groupMonthlyPrice}/mes por grupo para seguir creando partidos y cargando resultados.`,
    primaryCtaLabel: "Crear mi grupo gratis",
    listingCtaLabel: "Ver grupo de ejemplo",
    capabilitiesLabel: "Qué podés hacer con Grupos",
    capabilities: [
      "Crear y administrar uno o varios grupos desde la misma cuenta.",
      "Cargar jugadores con niveles simples, repetibles y editables.",
      "Armar equipos parejos usando nivel, rendimiento, invitados y arqueros.",
      "Publicar ranking, historial y próximos partidos para que cualquiera pueda consultarlos."
    ],
    focusTitle: "Fútbol ordenado, sin planillas eternas",
    focusDescription:
      "Grupos está pensado para el fútbol de todos los días: cargás jugadores, definís niveles, armás partidos parejos, guardás resultados y dejás ranking e historial listos para consultar.",
    problem: {
      title: "Menos discusiones, más fútbol",
      description:
        "Si siempre terminan armando equipos a ojo, discutiendo si quedaron desparejos o perdiendo el historial de los partidos, Grupos te ayuda a ordenar todo en un solo lugar.",
      items: [
        "Equipos más parejos",
        "Ranking público para el grupo",
        "Historial de partidos terminado",
        "Jugadores, invitados y arqueros contemplados",
        "Menos carga para el admin"
      ]
    },
    gettingStartedLabel: "Primeros pasos",
    gettingStarted: [
      {
        title: "1. Creás el grupo",
        description:
          "Cargás el nombre, una imagen representativa y dejás listo el espacio donde se van a organizar los partidos."
      },
      {
        title: "2. Cargás jugadores",
        description:
          "Asignás un nivel inicial simple: Figura, Muy bueno, Intermedio, Recreativo o Principiante."
      },
      {
        title: "3. Armás el partido",
        description:
          "Elegís convocados, invitados, arqueros y modalidad. La app te propone equipos parejos."
      },
      {
        title: "4. Cargás el resultado",
        description:
          "El rendimiento se actualiza y el historial queda guardado para que todos puedan consultarlo."
      }
    ],
    workflowLabel: "Cómo se usa semana a semana",
    workflow: [
      {
        title: "Convocatoria real",
        description:
          "Solo entran al armado los jugadores disponibles para esa fecha. Si aparece un invitado, podés asignarle un nivel equivalente sin cargarlo como jugador fijo."
      },
      {
        title: "Equipos parejos",
        description:
          "El armado mira el nivel base y el rendimiento actual. Si alguien viene rindiendo muy alto, la app lo considera más fuerte para emparejar mejor."
      },
      {
        title: "Historial consultable",
        description:
          "Los partidos terminados quedan publicados con marcador, equipos y estadísticas. La información se mueve poco y queda lista para consultar."
      }
    ],
    detailLabel: "Nivel, rendimiento y ranking explicado simple",
    detail: [
      {
        title: "Nivel",
        description:
          "Lo define el admin para representar qué tan bueno es un jugador de base. No cambia solo por ganar o perder."
      },
      {
        title: "Rendimiento",
        description:
          "Sube o baja según los resultados. Ayuda a reflejar quién viene jugando mejor dentro del grupo."
      },
      {
        title: "Ranking",
        description:
          "Ordena a los jugadores según su rendimiento. Es la tabla deportiva del grupo, no una lista fija armada a mano."
      },
      {
        title: "Armado de equipos",
        description:
          "Combina nivel + rendimiento para proponer partidos más parejos, sin mostrar fórmulas ni complicarle la vida al admin."
      }
    ],
    highlightCards: [
      {
        title: "Lo que ve cualquier jugador",
        description:
          "Ranking, jugadores, historial y próximos partidos. No necesita iniciar sesión para consultar la información pública del grupo."
      },
      {
        title: "Lo que controla el admin",
        description:
          "Jugadores, niveles, partidos, resultados, imagen del grupo, admins invitados y facturación."
      }
    ],
    faq: [
      {
        question: "¿Necesitan registrarse todos los jugadores?",
        answer:
          "No. El admin puede cargar jugadores y el grupo puede consultar ranking, historial y próximos partidos públicamente."
      },
      {
        question: "¿Puedo usarlo para fútbol 5, 6, 7 u 11?",
        answer: "Sí. Podés adaptar la modalidad según cómo juegue tu grupo."
      },
      {
        question: "¿La app arma los equipos sola?",
        answer:
          "La app propone equipos parejos, pero el admin siempre tiene la última palabra."
      },
      {
        question: "¿Puedo tener dos jugadores con el mismo nivel?",
        answer:
          "Sí. Esa es la idea: el nivel representa una categoría de habilidad, no una posición única dentro del grupo."
      },
      {
        question: "¿El nivel cambia solo?",
        answer:
          "No. El nivel lo edita el admin. Lo que cambia con cada resultado es el rendimiento competitivo."
      },
      {
        question: "¿Qué pasa si mi grupo ya tiene jugadores cargados?",
        answer:
          "Podés mantener el plantel y empezar a registrar partidos desde ahora sin perder lo que ya cargaste."
      },
      {
        question: "¿Qué pasa si no pago?",
        answer:
          "El grupo queda en modo lectura hasta reactivar el plan. La información deportiva se conserva."
      },
      {
        question: "¿Cuántos admins puede tener un grupo?",
        answer: "Hasta 4 administradores activos o pendientes de invitación por grupo."
      },
      {
        question: "¿Dónde pido ayuda?",
        answer:
          "Desde Contacto podés escribirnos por formulario o mail. También podés mandar sugerencias de producto."
      }
    ],
    finalCta: {
      title: "¿Listo para organizar tu grupo como corresponde?",
      description:
        "Probá Fábrica de Fútbol gratis durante 1 mes y empezá a armar partidos parejos con ranking e historial."
    }
  },
  tournaments: {
    eyebrow: "Ayuda para Torneos",
    title: "Administrá ligas y competencias sin mezclarlo con Grupos",
    description:
      "Torneos está pensado para organizadores: una liga contiene equipos maestros, admins y una o varias competencias públicas con fixture, tabla, resultados y estadísticas.",
    primaryCtaLabel: "Ir al panel de torneos",
    listingCtaLabel: "Ver torneos públicos",
    capabilitiesLabel: "Qué podés hacer",
    capabilities: [
      "Crear una liga como contenedor principal.",
      "Cargar equipos maestros y reutilizarlos en distintas competencias.",
      "Crear competencias públicas para que visitantes consulten la información.",
      "Elegir fixture automático o manual, con capitanes opcionales por equipo."
    ],
    focusTitle: "Qué conviene hacer primero",
    focusDescription:
      "Primero creás la liga, cargás los equipos maestros y definís si vas a usar capitanes. Después creás las competencias necesarias e inscribís solo los equipos que participan en cada una.",
    gettingStartedLabel: "Primeros pasos",
    gettingStarted: [
      {
        title: "1. Creás la liga",
        description:
          "La liga guarda nombre, logo, foto pública, sede, admins y facturación. Crear nuevas competencias dentro de esa liga no dispara un checkout nuevo."
      },
      {
        title: "2. Cargás equipos maestros",
        description:
          "El catálogo de equipos vive en la liga. Luego elegís cuáles se inscriben en cada competencia."
      },
      {
        title: "3. Creás una competencia",
        description:
          "La competencia define formato, temporada, cobertura de datos y equipos inscriptos. Todas las competencias quedan públicas por defecto."
      },
      {
        title: "4. Gestionás fixture y resultados",
        description:
          "Podés generar fechas automáticamente o cargar cruces manuales. Luego registrás resultados y, si corresponde, estadísticas del acta."
      }
    ],
    workflowLabel: "Cómo se opera una competencia",
    workflow: [
      {
        title: "Competencias claras",
        description:
          "En el admin se listan primero las competencias activas. La creación queda en una pantalla aparte para no ocupar espacio cuando ya estás trabajando."
      },
      {
        title: "Visibilidad para visitantes",
        description:
          "La información pública aparece cuando la liga y la competencia están activas o finalizadas. Así quien no está logueado puede consultar tabla, fixture y resultados."
      },
      {
        title: "Capitanes opcionales",
        description:
          "Podés invitar capitanes para completar planteles y fotos, o manejar todo desde el equipo admin de la liga."
      }
    ],
    detailLabel: "Tabla, fixture y estadísticas",
    detail: [
      {
        title: "Tabla de posiciones",
        description:
          "Se calcula automáticamente con puntos, diferencia de gol, goles a favor y desempates consistentes."
      },
      {
        title: "Fixture",
        description:
          "Round robin, copa o liga más copa. Si hay cantidad impar, se contempla fecha libre o pase de ronda cuando corresponde."
      },
      {
        title: "Resultados",
        description:
          "Podés cerrar un partido solo con marcador. Si querés más detalle, agregás goles, figuras y tarjetas."
      },
      {
        title: "Competencias públicas",
        description:
          "No hay checkbox para ocultarlas. Si la competencia no debe verse todavía, usá estado draft; si ya terminó, usá finished."
      }
    ],
    highlightCards: [
      {
        title: "Liga no es competencia",
        description:
          "La liga es el contenedor. La competencia es lo que se juega. Esto permite tener Viernes A, Viernes B o Copa dentro de la misma liga."
      },
      {
        title: "Qué ve el público",
        description:
          "Listado de ligas, ficha pública, competencias activas, tabla, fixture, detalle de partidos y estadísticas cargadas."
      }
    ],
    faq: [
      {
        question: "¿Crear una competencia nueva cobra otro mes?",
        answer:
          "No. La facturación de Torneos está asociada al alta de la liga. Dentro de una liga podés crear las competencias que necesites."
      },
      {
        question: "¿Puedo ocultar una competencia?",
        answer:
          "La competencia es pública por defecto. Para que no aparezca públicamente, mantenela en draft o archivá lo que ya no corresponda mostrar."
      },
      {
        question: "¿Los torneos usan los mismos jugadores que Grupos?",
        answer: "No. Son flujos separados para no mezclar historial, planteles ni permisos."
      },
      {
        question: "¿Cuántos admins puede tener una liga?",
        answer: "Hasta 4 administradores por liga."
      },
      {
        question: "¿Qué puede hacer un capitán?",
        answer:
          "Solo accede al equipo que el admin le asignó dentro de la competencia. Puede completar plantel y fotos, pero no administra la liga."
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
      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">{content.eyebrow}</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-slate-100 md:text-6xl">
          {content.title}
        </h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300 md:text-lg">{content.description}</p>
        {content.priceDescription ? (
          <p className="mt-4 max-w-3xl rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
            {content.priceDescription}
          </p>
        ) : null}
        <PublicModuleToggle
          basePath="/help"
          className="mt-5"
          currentModule={currentModule}
          organizationKey={organizationKey}
        />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)] transition hover:brightness-110"
            href={panelPath}
          >
            {content.primaryCtaLabel}
          </Link>
          <Link
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            href={listingPath}
          >
            {content.listingCtaLabel}
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href={pricingPath}
          >
            Ver precios
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href={feedbackPath}
          >
            Contacto
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <CardTitle>{content.capabilitiesLabel}</CardTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {content.capabilities.map((item) => (
              <p
                className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-200"
                key={item}
              >
                {item}
              </p>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <CardTitle>{content.focusTitle}</CardTitle>
          <CardDescription className="mt-3 leading-6">{content.focusDescription}</CardDescription>
        </Card>
      </section>

      {content.problem ? (
        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">El problema que resuelve</p>
          <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">{content.problem.title}</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 md:text-base">{content.problem.description}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {content.problem.items.map((item) => (
              <p
                className="rounded-2xl border border-emerald-400/20 bg-slate-950/55 px-4 py-3 text-sm font-semibold text-emerald-50"
                key={item}
              >
                {item}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{content.gettingStartedLabel}</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {content.gettingStarted.map((step) => (
            <Card className="p-5" key={step.title}>
              <CardTitle>{step.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">{step.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <AdPlaceholder slot="help-top-banner" />

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{content.workflowLabel}</p>
        <div className="grid gap-4 md:grid-cols-3">
          {content.workflow.map((item) => (
            <Card className="p-5" key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">{item.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{content.detailLabel}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {content.detail.map((item) => (
            <Card className="p-5" key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">{item.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {content.highlightCards.map((item) => (
          <Card className="p-5" key={item.title}>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription className="mt-2 leading-6">{item.description}</CardDescription>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Preguntas frecuentes</p>
        <div className="grid gap-3 md:grid-cols-2">
          {content.faq.map((item) => (
            <Card className="p-5" key={item.question}>
              <CardTitle className="text-base">{item.question}</CardTitle>
              <CardDescription className="mt-2 leading-6">{item.answer}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      {content.finalCta ? (
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 text-center shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
          <h2 className="text-3xl font-black text-white">{content.finalCta.title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
            {content.finalCta.description}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              href={panelPath}
            >
              Crear mi grupo gratis
            </Link>
            <Link
              className="rounded-md border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              href={pricingPath}
            >
              Ver precios
            </Link>
            <Link
              className="rounded-md border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
              href={feedbackPath}
            >
              Contactar soporte
            </Link>
          </div>
        </section>
      ) : null}

      <AdPlaceholder slot="help-bottom-banner" />
    </div>
  );
}
