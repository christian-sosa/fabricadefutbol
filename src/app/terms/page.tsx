import type { ReactNode } from "react";

import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ORGANIZATION_BILLING_CURRENCY, ORGANIZATION_MONTHLY_PRICE_ARS } from "@/lib/constants";
import { isTournamentsEnabled } from "@/lib/features";
import { resolvePublicModule, withPublicQuery } from "@/lib/org";

const LAST_UPDATED = "29 de abril de 2026";

function formatArs(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function LegalSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Card className="p-5">
      <CardTitle>{title}</CardTitle>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">{children}</div>
    </Card>
  );
}

function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3" key={item}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function TermsPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const currentModule = resolvePublicModule(resolvedSearchParams.module);
  const tournamentsEnabled = isTournamentsEnabled();

  return (
    <div className="space-y-5">
      <Card className="rounded-[2rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">Terminos</p>
        <CardTitle className="mt-2 text-3xl">Terminos y condiciones</CardTitle>
        <CardDescription className="mt-3 text-base">
          Estos terminos regulan el uso de Fabrica de Futbol, incluyendo la administracion de grupos, jugadores,
          partidos, rankings, historial, contenido publico, fotos y pagos del servicio.
        </CardDescription>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Ultima actualizacion: {LAST_UPDATED}
        </p>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <LegalSection title="1. Aceptacion">
          <p>
            Al navegar el sitio, crear una cuenta, administrar un grupo, cargar informacion o contratar un plan, aceptas
            estos terminos. Si usas el servicio en nombre de un grupo, equipo, liga u organizacion, declaras tener
            autorizacion suficiente para hacerlo.
          </p>
          <p>
            Si no estas de acuerdo con estas condiciones, no debes crear nuevos espacios ni cargar informacion en la
            plataforma. Puedes escribirnos para consultar dudas antes de continuar.
          </p>
        </LegalSection>

        <LegalSection title="2. Servicio">
          <p>
            Fabrica de Futbol es una herramienta SaaS para futbol amateur. Permite organizar jugadores, partidos,
            equipos, resultados, rankings, historial, proximas fechas y vistas publicas del grupo.
          </p>
          <p>
            {tournamentsEnabled
              ? "Cuando el modulo de torneos este disponible, tambien podra incluir ligas, competencias, equipos, fixture, tablas, resultados y estadisticas."
              : "El foco actual del servicio productivo esta en Grupos. Las funcionalidades de Torneos pueden estar ocultas, limitadas o en preparacion."}
          </p>
        </LegalSection>

        <LegalSection title="3. Cuentas y administradores">
          <LegalList
            items={[
              "La persona administradora es responsable de mantener sus credenciales seguras y de usar datos reales, actualizados y pertinentes.",
              "El administrador decide que informacion carga, que jugadores integra y que contenido queda disponible para vistas publicas.",
              "No esta permitido compartir accesos de forma que comprometa datos de terceros o permita acciones no autorizadas.",
              "Fabrica de Futbol puede limitar, suspender o cerrar accesos si detecta abuso, uso fraudulento, incumplimiento de pago o riesgo para otros usuarios."
            ]}
          />
        </LegalSection>

        <LegalSection title="4. Datos cargados por usuarios">
          <p>
            Los nombres de jugadores, niveles, resultados, estadisticas, fotos, equipos, fechas y demas contenidos
            cargados por administradores o usuarios autorizados son responsabilidad de quien los incorpora al servicio.
          </p>
          <p>
            Quien carga informacion de terceros declara contar con autorizacion, consentimiento o base suficiente para
            hacerlo, especialmente cuando se publiquen nombres, imagenes o datos deportivos en paginas visibles por
            visitantes.
          </p>
        </LegalSection>

        <LegalSection title="5. Contenido publico">
          <p>
            Algunas paginas del producto son publicas por diseno: ranking, historial, proximos partidos, informacion del
            grupo y perfiles asociados a la actividad deportiva. Estas vistas pueden mostrar nombres, fotos y rendimiento
            de jugadores cuando el administrador las haya cargado.
          </p>
          <p>
            El administrador debe revisar el contenido antes de publicarlo y atender pedidos razonables de correccion o
            baja de informacion de las personas involucradas.
          </p>
        </LegalSection>

        <LegalSection title="6. Fotos e imagenes">
          <LegalList
            items={[
              "Solo se deben subir imagenes propias, autorizadas o cuyo uso este permitido.",
              "No se deben cargar imagenes ofensivas, discriminatorias, enganosas, de terceros sin permiso o que vulneren derechos de imagen, privacidad o propiedad intelectual.",
              "Las fotos de jugadores se optimizan y reemplazan para evitar acumulacion innecesaria en Storage.",
              "El servicio puede aplicar limites de reemplazo, ventanas de espera y purgas de fotos cuando un grupo queda inactivo o fuera de periodo pago."
            ]}
          />
        </LegalSection>

        <LegalSection title="7. Uso permitido">
          <p>El servicio debe usarse de buena fe y para fines vinculados con organizacion deportiva amateur.</p>
          <LegalList
            items={[
              "No intentar acceder a cuentas, grupos, ligas o datos que no te correspondan.",
              "No interferir con la seguridad, disponibilidad, infraestructura, API o Storage del servicio.",
              "No cargar contenido ilegal, violento, discriminatorio, difamatorio, acosador o que exponga datos sensibles innecesarios.",
              "No usar automatizaciones abusivas, scraping no autorizado ni acciones que degraden el servicio para otros usuarios."
            ]}
          />
        </LegalSection>

        <LegalSection title="8. Planes, prueba y pagos">
          <p>
            Los grupos cuentan con un periodo de prueba de 30 dias. Finalizado ese periodo, la continuidad de la edicion
            y administracion requiere un plan activo. El precio publico vigente para Grupos es{" "}
            {ORGANIZATION_BILLING_CURRENCY} {formatArs(ORGANIZATION_MONTHLY_PRICE_ARS)} por mes, salvo promociones,
            acuerdos particulares o cambios publicados en la pagina de precios.
          </p>
          <p>
            Los pagos se procesan mediante Mercado Pago u otros proveedores que podamos habilitar. Fabrica de Futbol no
            almacena datos completos de tarjeta. Podemos conservar identificadores de pago, estado, periodo abonado y
            datos necesarios para conciliacion, soporte y cumplimiento.
          </p>
          <p>
            {tournamentsEnabled
              ? "Grupos y Torneos pueden tener reglas de facturacion separadas. En Torneos, la facturacion puede asociarse a la liga activa y no necesariamente a cada competencia creada."
              : "Si mas adelante se habilitan nuevos modulos, podran tener reglas de facturacion propias informadas antes de su contratacion."}
          </p>
        </LegalSection>

        <LegalSection title="9. Baja, vencimiento y reactivacion">
          <p>
            Si un periodo vence o el pago no se confirma, el espacio puede quedar protegido en modo lectura o con
            restricciones de edicion. La informacion deportiva no se elimina automaticamente por el solo vencimiento,
            pero ciertas fotos y archivos pueden quedar sujetos a retencion limitada para evitar costos innecesarios.
          </p>
          <p>
            Las solicitudes de baja, cambio de plan, inconvenientes de cobro o reclamos por pagos deben canalizarse por
            el formulario de contacto o por email.
          </p>
        </LegalSection>

        <LegalSection title="10. Disponibilidad">
          <p>
            Trabajamos para mantener el servicio disponible, seguro y actualizado. Aun asi, pueden existir interrupciones
            por mantenimiento, despliegues, incidentes tecnicos, proveedores externos, conectividad o causas fuera de
            nuestro control.
          </p>
          <p>
            Podemos modificar, mejorar, limitar o retirar funcionalidades cuando sea necesario para preservar la
            seguridad, el funcionamiento del producto o la calidad del servicio.
          </p>
        </LegalSection>

        <LegalSection title="11. Responsabilidad">
          <p>
            Fabrica de Futbol organiza informacion cargada por usuarios. No garantiza la exactitud de datos ingresados por
            administradores, capitanes o terceros, ni reemplaza la coordinacion real de los partidos.
          </p>
          <p>
            El servicio no es responsable por lesiones, conflictos entre jugadores, decisiones deportivas, sanciones
            internas, cancelaciones de partidos, uso indebido de imagenes cargadas por usuarios o informacion incorrecta
            incorporada por administradores.
          </p>
        </LegalSection>

        <LegalSection title="12. Propiedad intelectual">
          <p>
            La marca, el diseno, el software, las interfaces y el contenido propio de Fabrica de Futbol pertenecen al
            servicio o a sus licenciantes. No se permite copiarlos, revenderlos o explotarlos fuera del uso normal de la
            plataforma.
          </p>
          <p>
            Los usuarios conservan los derechos que correspondan sobre el contenido que cargan, pero autorizan a Fabrica
            de Futbol a almacenarlo, procesarlo, optimizarlo y mostrarlo en la medida necesaria para prestar el servicio.
          </p>
        </LegalSection>

        <LegalSection title="13. Cambios">
          <p>
            Podemos actualizar estos terminos para reflejar cambios de producto, legales, operativos o comerciales. La
            version vigente se publicara en esta pagina con su fecha de actualizacion.
          </p>
          <p>
            Si un cambio afecta de forma relevante el uso del servicio, procuraremos informarlo por canales razonables.
            El uso continuado del servicio despues de la publicacion de cambios implica aceptacion de la version vigente.
          </p>
        </LegalSection>

        <LegalSection title="14. Ley aplicable y contacto">
          <p>
            Estos terminos se interpretan conforme a la normativa aplicable en la Republica Argentina, incluyendo reglas
            de defensa del consumidor, proteccion de datos personales y comercio electronico cuando correspondan.
          </p>
          <p>
            Para consultas legales, comerciales, privacidad o soporte, escribinos a{" "}
            <a className="font-semibold text-emerald-300 transition hover:underline" href="mailto:info@fabricadefutbol.com.ar">
              info@fabricadefutbol.com.ar
            </a>
            .
          </p>
        </LegalSection>
      </section>

      <Link
        className="inline-flex rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
        href={withPublicQuery("/feedback", {
          organizationKey,
          module: currentModule
        })}
      >
        Consultar por terminos
      </Link>
    </div>
  );
}
