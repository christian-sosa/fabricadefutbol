# Paso a paso para produccion

## 1. Preparar Supabase

1. Crear el proyecto de Supabase de produccion.
2. Crear/aplicar el schema principal de la app. La configuracion recomendada usa `app_prod`.
3. Ejecutar las politicas y funciones RLS actuales.
4. Crear buckets de Storage:
   - `player-photos`
   - `organization-images`
   - `league-logos`
   - `league-photos`
   - `team-logos`
5. Revisar que RLS quede activo y que las policies de storage esten aplicadas.

## 2. Configurar super admin

La app ahora evita emails hardcodeados en SQL. El super admin se habilita con dos piezas:

1. Variable server `SUPER_ADMIN_EMAIL` para que la UI muestre accesos elevados.
2. Tabla SQL `app_prod.super_admin_emails` para que la base autorice esos permisos con RLS.

En Supabase SQL Editor, crear/verificar la tabla `app_prod.super_admin_emails` segun las politicas SQL del proyecto.
Despues crear el usuario en Supabase Auth con el mismo email y ejecutar, reemplazando el placeholder por tu email real solo en el panel de Supabase:

```sql
insert into app_prod.super_admin_emails(email)
values (lower('<EMAIL_SUPER_ADMIN>'))
on conflict (email) do nothing;
```

Verificacion rapida:

```sql
select * from app_prod.super_admin_emails;
```

## 3. Variables de entorno en hosting

Configurar estas variables en produccion:

```dotenv
APP_URL=https://tu-dominio.com
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto-prod.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-prod
NEXT_PUBLIC_SUPABASE_DB_SCHEMA=app_prod
SUPABASE_PLAYER_PHOTOS_BUCKET=player-photos
SUPER_ADMIN_EMAIL=<EMAIL_SUPER_ADMIN>
NEXT_PUBLIC_ENABLE_ADS=false
NEXT_PUBLIC_SPEED_INSIGHTS_ENABLED=false
CRON_SECRET=un-secreto-largo-y-unico
```

Opcionales segun lo que actives:

```dotenv
RESEND_API_KEY=re_xxx
FEEDBACK_FROM_EMAIL=Fabrica de Futbol <no-reply@tu-dominio.com>
FEEDBACK_TO_EMAIL=soporte@tu-dominio.com
MERCADOPAGO_ACCESS_TOKEN=APP_USR_xxx
MERCADOPAGO_WEBHOOK_SECRET=xxx
MERCADOPAGO_WEBHOOK_BASE_URL=https://tu-dominio.com
MERCADOPAGO_USE_SANDBOX=false
NEXT_PUBLIC_ENABLE_ADS=true
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-xxx
```

## 4. Validar antes del deploy

En local, antes de publicar:

```powershell
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

## 5. Deploy

1. Conectar el repo al hosting.
2. Confirmar que el build command sea `npm run build`.
3. Confirmar que el start command sea `npm run start` si tu hosting lo pide.
4. Cargar variables de entorno de produccion.
5. Deployar.

## 6. Smoke test post-deploy

1. Abrir home publica.
2. Entrar con el email del super admin.
3. Confirmar que `/admin` muestra todos los grupos.
4. Crear o editar un grupo de prueba.
5. Revisar ranking, historial y proximos desde URLs publicas.
6. Probar carga y render de foto de jugador.
7. Revisar logs por errores 500 o warnings de variables faltantes.

## 7. Cuidado de costos

- Mantener Ads y Speed Insights apagados hasta necesitarlos.
- Preferir snapshots publicos y cache `s-maxage` para ranking/historial.
- Evitar service role en cliente.
- Usar buckets y redirects firmados para imagenes.
- Agregar rate limit persistente en Redis/Postgres cuando haya trafico real.
