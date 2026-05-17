# Local DEV

Este flujo es para levantar la app en localhost, sin depender de Vercel.

## 1. Requisitos

- Node 20.19+ o Node 22.13+.
- Dependencias instaladas con `npm install`.
- Un proyecto Supabase de desarrollo si queres probar login, admin, imagenes y datos reales.

## 2. Variables locales

Si ya tenes `.env.local`, no lo pises. Para un entorno limpio podes crear:

```powershell
Copy-Item .env.example .env.development.local
```

Minimo recomendado para probar datos reales:

```dotenv
SUPABASE_TARGET_ENV=development
NEXT_PUBLIC_SUPABASE_URL_DEV=https://tu-proyecto-dev.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY_DEV=tu-service-role-dev
NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV=app_dev
SUPABASE_PLAYER_PHOTOS_BUCKET_DEV=player-photos-dev
SUPER_ADMIN_EMAIL=<EMAIL_SUPER_ADMIN>
NEXT_PUBLIC_ENABLE_ADS=false
NEXT_PUBLIC_SPEED_INSIGHTS_ENABLED=false
```

Sin variables de Supabase, la app ya puede abrir la cascara publica en localhost con datos vacios. Login/admin y APIs con datos reales necesitan Supabase.

## 3. Levantar servidor

```powershell
npm run dev:local
```

Abrir:

```text
http://127.0.0.1:3000
```

Si el puerto 3000 esta ocupado:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3001
```

## 4. Probar cambios antes de subir

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Para revisar rapido en navegador: home, `/groups`, `/admin/login`, alta/login, panel admin, carga de grupo, ranking publico y una foto de jugador.
