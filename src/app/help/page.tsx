import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ORGANIZATION_BILLING_CURRENCY, ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";

function formatCurrencyArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: ORGANIZATION_BILLING_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

const gettingStartedSteps = [
  {
    title: "1. Crea tu cuenta y activa tu organizacion",
    description:
      "Ingresa al panel, registrate con tu email y crea la organizacion que vas a administrar. Desde ese momento ya puedes empezar a cargar tu plantel y trabajar sobre tus partidos."
  },
  {
    title: "2. Carga tu plantel base",
    description:
      "En la seccion Jugadores agrega a cada integrante del equipo. El nombre es obligatorio y el orden inicial te sirve para ordenar tu plantel desde el primer dia. Ese orden no se modifica solo con los partidos: solo cambia si un administrador decide editarlo."
  },
  {
    title: "3. Crea tu primer partido",
    description:
      "En Nuevo Partido eliges modalidad, fecha y convocatoria. Puedes trabajar solo con jugadores registrados o sumar invitados puntuales con un rating manual si participaron esa fecha pero no forman parte fija del plantel."
  },
  {
    title: "4. Confirma equipos y carga el resultado",
    description:
      "La app genera opciones equilibradas para que elijas una formacion final. Cuando el partido se juega, cargas el resultado y el sistema actualiza automaticamente el ranking de los jugadores."
  }
];

const matchFlowItems = [
  {
    title: "Convocatoria clara",
    description:
      "El sistema arma los equipos a partir de la lista de convocados del partido. Eso te permite trabajar con la disponibilidad real de cada fecha y no solo con el plantel completo."
  },
  {
    title: "Equipos balanceados",
    description:
      "Las opciones automaticas buscan reducir la diferencia de rating entre ambos lados y, ademas, penalizan combinaciones donde los jugadores de mayor nivel quedan juntos en el mismo equipo."
  },
  {
    title: "Flexibilidad para la cancha real",
    description:
      "Si hubo ausencias, reemplazos o invitados de ultimo momento, puedes ajustar la formacion antes de cargar el resultado final para que el historial quede fiel a lo que paso en el partido."
  }
];

const ratingPrinciples = [
  {
    title: "Orden inicial del plantel",
    description:
      "El ranking inicial del plantel es una referencia manual definida por el administrador para ordenar a los jugadores dentro de la organizacion. Ese orden no se mueve automaticamente con los resultados: solo cambia si el admin decide editarlo."
  },
  {
    title: "Punto de partida del rating",
    description:
      "Cada jugador registrado comienza con un rating competitivo de 1000 puntos. Ese valor si es dinamico y funciona como base para medir su evolucion con el paso de los partidos."
  },
  {
    title: "Como se actualiza",
    description:
      "Cuando cargas un resultado, una victoria suma 10 puntos a los jugadores del equipo ganador y una derrota resta 10 al equipo que pierde. Si el partido termina empatado, el rating no se modifica."
  },
  {
    title: "Partidos en inferioridad",
    description:
      "Si un equipo juega con menos jugadores, el ajuste se adapta para no medir igual una desventaja numerica. Una victoria en inferioridad se premia mas, y una derrota en esa condicion recibe un tratamiento mas suave."
  },
  {
    title: "Orden del ranking",
    description:
      "La tabla publica de ranking se ordena por el rating actual de cada jugador. Cuanto mejor sea su rendimiento acumulado, mas arriba aparecera en la clasificacion."
  }
];

const faqItems = [
  {
    question: "Que informacion es publica?",
    answer:
      "Las organizaciones publicas muestran ranking, jugadores, historial de partidos y proximos encuentros. La gestion y edicion quedan reservadas para los administradores."
  },
  {
    question: "Cuantos administradores puede tener una organizacion?",
    answer:
      "Cada organizacion admite hasta 4 administradores activos o pendientes de invitacion. Eso permite repartir la gestion sin perder control."
  },
  {
    question: "La plataforma tiene costo?",
    answer:
      `Cada organizacion cuenta con 1 mes gratis desde su creacion. Finalizado ese periodo, el costo es ${formatCurrencyArs(ORGANIZATION_MONTHLY_PRICE_ARS)} por mes por organizacion para mantener la edicion habilitada.`
  },
  {
    question: "Que pasa cuando termina el periodo gratis?",
    answer:
      "La organizacion queda en modo solo lectura. La informacion se conserva y sigue visible, pero se bloquean las acciones de alta, edicion y borrado hasta reactivar el plan."
  },
  {
    question: "Donde puedo hacer consultas o reportar un problema?",
    answer:
      "En la seccion Contacto puedes enviar sugerencias, consultas o reportes de error para que el equipo los revise."
  }
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-[0_24px_40px_-30px_rgba(16,185,129,0.7)] md:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400">Centro de ayuda</p>
        <h1 className="mt-2 text-3xl font-black text-slate-100 md:text-5xl">Como funciona Fabrica de Futbol</h1>
        <p className="mt-3 max-w-4xl text-sm text-slate-300 md:text-base">
          Fabrica de Futbol es una plataforma para organizar futbol amateur de manera ordenada y profesional.
          Te permite administrar tu plantel, convocar jugadores, generar equipos equilibrados, registrar resultados
          y mantener un ranking actualizado de rendimiento.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_24px_-14px_rgba(16,185,129,1)]"
            href="/admin/login"
          >
            Crear cuenta o ingresar
          </Link>
          <Link
            className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            href="/pricing"
          >
            Ver precios
          </Link>
          <Link
            className="rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            href="/feedback"
          >
            Contacto
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Que puedes hacer en la plataforma</CardTitle>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>Administrar una o varias organizaciones.</p>
            <p>Cargar jugadores y mantener un plantel ordenado.</p>
            <p>Crear partidos, convocar participantes y generar equipos.</p>
            <p>Registrar resultados y actualizar automaticamente el ranking.</p>
          </div>
        </Card>
        <Card>
          <CardTitle>En que conviene enfocarse al principio</CardTitle>
          <CardDescription className="mt-2">
            Si estas empezando, lo mas recomendable es construir primero una buena base de jugadores, luego crear tus
            primeros partidos y finalmente empezar a cargar resultados para que el ranking gane valor con el tiempo.
          </CardDescription>
        </Card>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Primeros pasos</p>
        <div className="grid gap-4 md:grid-cols-2">
          {gettingStartedSteps.map((step) => (
            <Card key={step.title}>
              <CardTitle>{step.title}</CardTitle>
              <CardDescription className="mt-2">{step.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <AdPlaceholder slot="help-top-banner" />

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Como arrancar a cargar tu equipo</p>
        <div className="grid gap-4 md:grid-cols-3">
          {matchFlowItems.map((item) => (
            <Card key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription className="mt-2">{item.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Ranking de jugadores</p>
        <div className="grid gap-4 md:grid-cols-2">
          {ratingPrinciples.map((item) => (
            <Card key={item.title}>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription className="mt-2">{item.description}</CardDescription>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardTitle>Como interpretar el ranking</CardTitle>
          <CardDescription className="mt-2">
            Hay dos referencias distintas dentro de la plataforma. Por un lado, el orden inicial del plantel, que es
            manual y lo administra tu equipo. Por otro, el ranking competitivo, que se calcula con el rating actual de
            cada jugador y si evoluciona con los resultados cargados.
          </CardDescription>
        </Card>
        <Card>
          <CardTitle>Consejo practico</CardTitle>
          <CardDescription className="mt-2">
            Si el grupo es nuevo o todavia no tiene historial, empieza cargando a todos los jugadores y juega algunos
            partidos con normalidad. A medida que se sumen resultados, el ranking competitivo va a reflejar mejor la
            realidad del equipo.
          </CardDescription>
        </Card>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Preguntas frecuentes</p>
        <div className="space-y-3">
          {faqItems.map((item) => (
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
