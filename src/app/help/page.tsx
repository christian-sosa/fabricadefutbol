import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { withPublicQuery } from "@/lib/org";

type HelpSectionItem = {
  title: string;
  description: string;
};

type HelpFaqItem = {
  question: string;
  answer: string;
};

const capabilities = [
  "Crear y administrar un grupo gratis desde tu cuenta.",
  "Cargar jugadores con niveles simples, repetibles y editables.",
  "Armar equipos parejos usando nivel, rendimiento, invitados y arqueros.",
  "Publicar ranking, historial y proximos partidos para que cualquiera pueda consultarlos."
] as const;

const problemItems = [
  "Equipos mas parejos",
  "Ranking publico para el grupo",
  "Historial de partidos terminado",
  "Jugadores, invitados y arqueros contemplados",
  "Menos carga para el admin"
] as const;

const gettingStarted: HelpSectionItem[] = [
  {
    title: "1. Creas el grupo",
    description:
      "Cargas el nombre, una foto representativa y dejas listo el espacio donde se van a organizar los partidos."
  },
  {
    title: "2. Cargas jugadores",
    description:
      "Asignas un nivel inicial simple: Estrella, Figura, Muy bueno, Bueno, Intermedio, Recreativo o Principiante."
  },
  {
    title: "3. Armas el partido",
    description:
      "Elegis convocados, invitados, arqueros y modalidad. La app te propone equipos parejos."
  },
  {
    title: "4. Cargas el resultado",
    description:
      "El rendimiento se actualiza y el historial queda guardado para que todos puedan consultarlo."
  }
];

const weeklyWorkflow: HelpSectionItem[] = [
  {
    title: "Convocatoria real",
    description:
      "Solo entran al armado los jugadores disponibles para esa fecha. Si aparece un invitado, podes asignarle un nivel equivalente sin cargarlo como jugador fijo."
  },
  {
    title: "Equipos parejos",
    description:
      "El armado mira el nivel base y el rendimiento actual. Si alguien viene rindiendo muy alto, la app lo considera mas fuerte para emparejar mejor."
  },
  {
    title: "Historial consultable",
    description:
      "Los partidos terminados quedan publicados con marcador, equipos y estadisticas. La informacion se mueve poco y queda lista para consultar."
  }
];

const rankingDetails: HelpSectionItem[] = [
  {
    title: "Nivel",
    description:
      "Lo define el admin para representar que tan bueno es un jugador de base. No cambia solo por ganar o perder."
  },
  {
    title: "Rendimiento",
    description:
      "Sube o baja segun los resultados. Ayuda a reflejar quien viene jugando mejor dentro del grupo."
  },
  {
    title: "Ranking",
    description:
      "Ordena a los jugadores segun su rendimiento. Es la tabla deportiva del grupo, no una lista fija armada a mano."
  },
  {
    title: "Armado de equipos",
    description:
      "Combina nivel y rendimiento para proponer partidos mas parejos, sin mostrar formulas ni complicarle la vida al admin."
  }
];

const highlightCards: HelpSectionItem[] = [
  {
    title: "Lo que ve cualquier jugador",
    description:
      "Ranking, jugadores, historial y proximos partidos. No necesita iniciar sesion para consultar la informacion publica del grupo."
  },
  {
    title: "Lo que controla el admin",
    description:
      "Jugadores, niveles, partidos, resultados, foto de portada del grupo y admins invitados."
  }
];

const faq: HelpFaqItem[] = [
  {
    question: "Necesitan registrarse todos los jugadores?",
    answer:
      "No. El admin puede cargar jugadores y el grupo puede consultar ranking, historial y proximos partidos publicamente."
  },
  {
    question: "Puedo usarlo para futbol 5, 6, 7 u 11?",
    answer: "Si. Podes adaptar la modalidad segun como juegue tu grupo."
  },
  {
    question: "La app arma los equipos sola?",
    answer:
      "La app propone equipos parejos, pero el admin siempre tiene la ultima palabra."
  },
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
    question: "Que pasa si mi grupo ya tiene jugadores cargados?",
    answer:
      "Podes mantener el plantel y empezar a registrar partidos desde ahora sin perder lo que ya cargaste."
  },
  {
    question: "Cuanto cuesta usar Grupos?",
    answer:
      "Grupos es gratis para arrancar y usar con tu equipo. Si administras varios grupos, escribinos desde Contacto y lo vemos."
  },
  {
    question: "Cuantos admins puede tener un grupo?",
    answer: "Hasta 4 administradores activos o pendientes de invitacion por grupo."
  },
  {
    question: "Donde pido ayuda?",
    answer:
      "Desde Contacto podes escribirnos por formulario o mail. Tambien podes mandar sugerencias de producto."
  }
];

export default async function HelpPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const panelPath = withPublicQuery("/admin", { organizationKey });
  const listingPath = withPublicQuery("/groups", { organizationKey });
  const guidesPath = withPublicQuery("/guides", { organizationKey });
  const feedbackPath = withPublicQuery("/feedback", { organizationKey });

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Ayuda para Grupos</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-slate-100 md:text-6xl">
          Organiza tu grupo sin discusiones
        </h1>
        <p className="mt-4 max-w-4xl text-base leading-7 text-slate-300 md:text-lg">
          Arma partidos parejos, carga resultados y mantene un ranking real de tu grupo. Fabrica de Futbol es gratis para Grupos y te ayuda a llevar historial, jugadores y proximos partidos en un solo lugar.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)] transition hover:brightness-110"
            href={panelPath}
          >
            Crear mi grupo gratis
          </Link>
          <Link
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            href={listingPath}
          >
            Ver grupo de ejemplo
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href={guidesPath}
          >
            Ver guias
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
          <CardTitle>Que podes hacer con Grupos</CardTitle>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {capabilities.map((item) => (
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
          <CardTitle>Futbol ordenado, sin planillas eternas</CardTitle>
          <CardDescription className="mt-3 leading-6">
            Grupos esta pensado para el futbol de todos los dias: cargas jugadores, definis niveles, armas partidos parejos, guardas resultados y dejas ranking e historial listos para consultar.
          </CardDescription>
        </Card>
      </section>

      <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-5 md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">El problema que resuelve</p>
        <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">Menos discusiones, mas futbol</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 md:text-base">
          Si siempre terminan armando equipos a ojo, discutiendo si quedaron desparejos o perdiendo el historial de los partidos, Grupos te ayuda a ordenar todo en un solo lugar.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {problemItems.map((item) => (
            <p
              className="rounded-2xl border border-emerald-400/20 bg-slate-950/55 px-4 py-3 text-sm font-semibold text-emerald-50"
              key={item}
            >
              {item}
            </p>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Primeros pasos</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {gettingStarted.map((step) => (
            <Card className="p-5" key={step.title}>
              <CardTitle>{step.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">{step.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Como se usa semana a semana</p>
        <div className="grid gap-4 md:grid-cols-3">
          {weeklyWorkflow.map((item) => (
            <Card className="p-5" key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">{item.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Nivel, rendimiento y ranking explicado simple</p>
        <div className="grid gap-4 md:grid-cols-2">
          {rankingDetails.map((item) => (
            <Card className="p-5" key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription className="mt-2 leading-6">{item.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {highlightCards.map((item) => (
          <Card className="p-5" key={item.title}>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription className="mt-2 leading-6">{item.description}</CardDescription>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Preguntas frecuentes</p>
        <div className="grid gap-3 md:grid-cols-2">
          {faq.map((item) => (
            <Card className="p-5" key={item.question}>
              <CardTitle className="text-base">{item.question}</CardTitle>
              <CardDescription className="mt-2 leading-6">{item.answer}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 text-center shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <h2 className="text-3xl font-black text-white">Listo para organizar tu grupo como corresponde?</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
          Crea tu grupo gratis y empeza a armar partidos parejos con ranking e historial.
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
            href={guidesPath}
          >
            Ver guias
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-900"
            href={feedbackPath}
          >
            Contactar soporte
          </Link>
        </div>
      </section>
    </div>
  );
}
