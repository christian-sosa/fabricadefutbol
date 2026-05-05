import type { ReactNode } from "react";

import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getCurrentUserIsSuperAdmin } from "@/lib/auth/super-admin";
import { ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS } from "@/lib/constants";
import { resolvePublicModule, withPublicQuery } from "@/lib/org";

const LAST_UPDATED = "2 de mayo de 2026";

function PrivacySection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Card className="p-5">
      <CardTitle>{title}</CardTitle>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">{children}</div>
    </Card>
  );
}

function PrivacyList({ items }: { items: string[] }) {
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

export default async function PrivacyPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const organizationKey = resolvedSearchParams.org ?? null;
  const canAccessTournaments = await getCurrentUserIsSuperAdmin();
  const requestedModule = resolvePublicModule(resolvedSearchParams.module);
  const currentModule = canAccessTournaments ? requestedModule : "organizations";

  return (
    <div className="space-y-5">
      <Card className="rounded-[2rem] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Privacidad</p>
        <CardTitle className="mt-2 text-3xl">Politica de privacidad</CardTitle>
        <CardDescription className="mt-3 text-base">
          Esta politica explica como Fabrica de Futbol trata informacion de administradores, jugadores, visitantes,
          grupos, fotos, publicidad, mensajes de contacto y datos tecnicos necesarios para operar el servicio.
        </CardDescription>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Ultima actualizacion: {LAST_UPDATED}
        </p>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2">
        <PrivacySection title="1. Responsable y contacto">
          <p>
            El responsable operativo del tratamiento es Fabrica de Futbol, disponible en fabricadefutbol.com.ar. Para
            ejercer derechos, hacer consultas o pedir correcciones, escribinos a{" "}
            <a className="font-semibold text-emerald-300 transition hover:underline" href="mailto:info@fabricadefutbol.com.ar">
              info@fabricadefutbol.com.ar
            </a>
            .
          </p>
          <p>
            Esta politica aplica al sitio, al panel de administracion, a las paginas publicas de grupos y a los flujos de
            soporte, publicidad, pagos historicos o integraciones futuras y carga de imagenes.
          </p>
        </PrivacySection>

        <PrivacySection title="2. Datos que podemos tratar">
          <PrivacyList
            items={[
              "Datos de cuenta y acceso: email, identificadores de usuario, sesiones, rol de administrador y fechas de alta.",
              "Datos de grupos: nombre, slug, configuracion, administradores, actividad e informacion publica asociada.",
              "Datos de jugadores: nombre, orden, nivel, ranking, rendimiento, estadisticas, asistencia a partidos, resultados y fotos si fueron cargadas.",
              ...(canAccessTournaments
                ? [
                    "Datos de torneos: ligas, competencias, equipos, capitanes, planteles, fixture, tablas, resultados y estadisticas."
                  ]
                : []),
              `Datos de soporte: nombre, email, tema, mensaje, ${
                canAccessTournaments ? "grupo o torneo referido" : "grupo referido"
              } y comunicaciones posteriores.`,
              "Datos de publicidad y navegacion: cookies de terceros, direccion IP, identificadores tecnicos, informacion del navegador, impresiones y eventos publicitarios cuando se habilite Google AdSense.",
              "Datos de pago solo para flujos historicos, integraciones futuras o contrataciones habilitadas: identificadores de operacion, proveedor, estado, periodo abonado, moneda, importe y fechas relevantes. No almacenamos datos completos de tarjeta."
            ]}
          />
        </PrivacySection>

        <PrivacySection title="3. Como obtenemos la informacion">
          <p>
            La informacion puede ser ingresada por el propio usuario, por administradores del grupo, por capitanes o
            responsables autorizados, por proveedores de pago cuando correspondan, por proveedores publicitarios y por
            sistemas tecnicos que permiten autenticar, proteger y medir el funcionamiento del servicio.
          </p>
          <p>
            Si una persona administradora carga datos de terceros, debe contar con autorizacion, consentimiento o base
            suficiente para hacerlo, en especial cuando la informacion se publique en ranking, historial, proximas fechas
            o perfiles visibles.
          </p>
        </PrivacySection>

        <PrivacySection title="4. Para que usamos los datos">
          <PrivacyList
            items={[
              "Crear y administrar cuentas, grupos, jugadores, partidos, rankings, historial y paginas publicas.",
              "Calcular rendimiento, resultados, equipos y estadisticas deportivas.",
              "Mostrar informacion publica del grupo cuando el administrador decide usar esas vistas.",
              "Procesar pagos solo cuando corresponda a flujos historicos, integraciones futuras o contrataciones habilitadas.",
              "Mostrar publicidad mediante Google AdSense cuando la configuracion publica de anuncios este habilitada.",
              "Responder consultas, reportes de error, pedidos comerciales y solicitudes legales o de privacidad.",
              "Prevenir abuso, proteger cuentas, investigar incidentes, depurar errores y mejorar estabilidad del servicio."
            ]}
          />
        </PrivacySection>

        <PrivacySection title="5. Paginas publicas y visibilidad">
          <p>
            Algunas secciones son publicas por naturaleza. Por ejemplo, ranking, historial, proximos partidos y paginas
            del grupo pueden mostrar nombres, rendimiento, estadisticas y fotos de jugadores.
          </p>
          <p>
            Si no queres que tu nombre, foto o informacion deportiva aparezca en una vista publica, podes pedirle al
            administrador del grupo que la corrija o escribirnos para que evaluemos la solicitud.
          </p>
        </PrivacySection>

        <PrivacySection title="6. Fotos de jugadores">
          <p>
            Las fotos se usan para identificar jugadores dentro de vistas del producto. Se optimizan, se guardan en
            formato liviano y se reemplazan en vez de acumular versiones indefinidas.
          </p>
          <p>
            Para reducir abusos y costos, el servicio aplica limites de subida y reemplazo. Actualmente, una misma
            persona puede reemplazar su foto hasta 2 veces dentro de una ventana de 3 meses, y los capitanes tienen un
            limite global de subidas por ventana. Si un grupo queda inactivo, las fotos de jugadores pueden purgarse
            luego de {ORGANIZATION_PLAYER_PHOTO_RETENTION_DAYS} dias sin borrar datos deportivos ni la imagen del grupo.
          </p>
        </PrivacySection>

        <PrivacySection title="7. Pagos y proveedores">
          <p>
            {canAccessTournaments
              ? "Grupos es gratis en esta etapa y no inicia pagos nuevos para crear o administrar grupos. Torneos, flujos historicos o integraciones futuras pueden usar Mercado Pago u otros proveedores."
              : "Grupos es gratis en esta etapa y no inicia pagos nuevos para crear o administrar grupos. Flujos historicos, integraciones futuras o contrataciones habilitadas pueden usar Mercado Pago u otros proveedores."}
          </p>
          <p>
            Cuando exista un pago, esos proveedores tratan informacion segun sus propias politicas. Fabrica de Futbol
            conserva solo datos necesarios para confirmar operaciones, conciliar periodos, responder consultas y cumplir
            obligaciones aplicables.
          </p>
        </PrivacySection>

        <PrivacySection title="8. Infraestructura y encargados">
          <p>
            Para operar el servicio usamos proveedores de infraestructura, base de datos, autenticacion, almacenamiento,
            despliegue, analitica, email, soporte, publicidad y pagos cuando correspondan. Entre ellos pueden
            encontrarse Supabase, Vercel, Google AdSense, Mercado Pago y servicios equivalentes que cumplan funciones
            necesarias para prestar el producto.
          </p>
          <p>
            Estos proveedores pueden procesar datos dentro o fuera de Argentina. En esos casos, buscamos limitar la
            informacion compartida a lo necesario y mantener medidas razonables de seguridad, confidencialidad y control
            de acceso.
          </p>
        </PrivacySection>

        <PrivacySection title="9. Cookies, sesiones y analitica">
          <p>
            El sitio puede usar cookies o tecnologias similares para mantener sesiones, recordar preferencias tecnicas,
            proteger accesos y medir uso agregado del producto. Tambien puede usar analitica de Vercel u otra herramienta
            equivalente para entender rendimiento, errores y navegacion general.
          </p>
          <p>
            Cuando Google AdSense esta habilitado, Google y sus socios pueden usar cookies de terceros, web beacons,
            direccion IP, identificadores tecnicos del navegador o dispositivo, datos de impresiones y datos de
            interaccion para publicar anuncios, limitar frecuencia, medir rendimiento y prevenir fraude. Podes leer{" "}
            <a
              className="font-semibold text-emerald-300 transition hover:underline"
              href="https://policies.google.com/technologies/partner-sites"
              rel="noreferrer"
              target="_blank"
            >
              como Google usa datos de sitios o apps que usan sus servicios
            </a>
            .
          </p>
          <p>
            No buscamos vender informacion personal ni crear perfiles publicitarios sensibles a partir de los datos
            deportivos del grupo.
          </p>
        </PrivacySection>

        <PrivacySection title="10. Seguridad">
          <PrivacyList
            items={[
              "Usamos autenticacion, permisos por rol y reglas de acceso para separar informacion publica y privada.",
              "Las operaciones sensibles se ejecutan desde servidor y las claves privadas no deben exponerse al navegador.",
              "Los accesos a datos se limitan segun necesidad operativa, soporte, seguridad o cumplimiento.",
              "Ningun sistema es infalible; si detectas una vulnerabilidad o acceso indebido, escribinos cuanto antes."
            ]}
          />
        </PrivacySection>

        <PrivacySection title="11. Conservacion">
          <p>
            Conservamos la informacion mientras sea necesaria para prestar el servicio, mantener historial deportivo,
            cumplir obligaciones legales o contractuales, resolver reclamos, prevenir fraude y sostener copias de
            seguridad razonables.
          </p>
          <p>
            Cuando una cuenta, grupo o dato se elimina, puede existir un plazo tecnico de propagacion en backups,
            registros de seguridad o sistemas de proveedores. Las fotos de jugadores tienen reglas especificas de
            reemplazo y retencion para evitar acumulacion innecesaria.
          </p>
        </PrivacySection>

        <PrivacySection title="12. Derechos sobre tus datos">
          <p>
            En Argentina, la normativa de proteccion de datos personales reconoce derechos de acceso, rectificacion,
            actualizacion, supresion y confidencialidad. Podes ejercerlos escribiendo a nuestro email de contacto con
            informacion suficiente para identificar el dato y el grupo relacionado.
          </p>
          <p>
            Si la informacion fue cargada por un administrador del grupo, podemos pedir validaciones adicionales o
            coordinar con ese administrador para evitar afectar derechos de otras personas o registros deportivos
            legitimos.
          </p>
        </PrivacySection>

        <PrivacySection title="13. Menores de edad">
          <p>
            El servicio esta pensado para organizadores y administradores con capacidad suficiente para contratar o
            gestionar espacios deportivos. Si se cargan datos o imagenes de menores de edad, el administrador declara
            contar con autorizacion de sus responsables legales y debera removerlos si esa autorizacion no existe o es
            retirada.
          </p>
        </PrivacySection>

        <PrivacySection title="14. Cambios en esta politica">
          <p>
            Podemos actualizar esta politica para reflejar cambios de producto, proveedores, seguridad, obligaciones
            legales o practicas operativas. La version vigente se publicara en esta pagina junto con su fecha de
            actualizacion.
          </p>
          <p>
            Si el cambio es relevante, procuraremos comunicarlo por un medio razonable dentro del producto o por los
            canales de contacto disponibles.
          </p>
        </PrivacySection>
      </section>

      <Link
        className="inline-flex rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
        href={withPublicQuery("/feedback", {
          organizationKey,
          module: currentModule
        })}
      >
        Consultar privacidad
      </Link>
    </div>
  );
}
