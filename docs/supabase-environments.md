# Ambientes Supabase con un solo proyecto (schemas separados)

## Resumen

- Se usa **el mismo proyecto Supabase** (misma URL y mismas keys).
- Se separa data por schema:
  - `app_dev` para local/dev
  - `app_prod` para produccion
- Para fotos, conviene separar bucket tambien:
  - `player-photos-dev`
  - `player-photos`

## Variables

Produccion:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_DB_SCHEMA=app_prod`
- `SUPABASE_PLAYER_PHOTOS_BUCKET=player-photos`

Desarrollo local:

- `NEXT_PUBLIC_SUPABASE_URL_DEV` (puede ser igual a la de prod si es el mismo proyecto)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV` (idem)
- `SUPABASE_SERVICE_ROLE_KEY_DEV` (idem)
- `NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV=app_dev`
- `SUPABASE_PLAYER_PHOTOS_BUCKET_DEV=player-photos-dev`

## Migraciones SQL por schema

Tus scripts base estan en `public`. Para evitar errores manuales, usa el generador:

```bash
npm run sql:build-schema -- app_prod
npm run sql:build-schema -- app_dev
```

Se generan:

- `supabase/generated/schema.<schema>.sql`
- `supabase/generated/policies.<schema>.sql`
- `supabase/generated/policies.storage.sql` (global, se ejecuta 1 vez)

Orden recomendado en Supabase SQL Editor:

1. `create schema if not exists app_prod;`
2. Ejecutar `supabase/generated/schema.app_prod.sql`
3. Ejecutar `supabase/generated/policies.app_prod.sql`
4. `create schema if not exists app_dev;`
5. Ejecutar `supabase/generated/schema.app_dev.sql`
6. Ejecutar `supabase/generated/policies.app_dev.sql`
7. Ejecutar una sola vez `supabase/generated/policies.storage.sql`
8. En `Settings > API > Exposed schemas`, agregar `app_prod, app_dev`

## Bucket: punto de partida igual en ambos

Si queres mismo contenido inicial de fotos:

```bash
SUPABASE_COPY_SOURCE_URL=...
SUPABASE_COPY_SOURCE_SERVICE_ROLE_KEY=...
SUPABASE_COPY_TARGET_URL=...
SUPABASE_COPY_TARGET_SERVICE_ROLE_KEY=...
SUPABASE_COPY_SOURCE_BUCKET=player-photos
SUPABASE_COPY_TARGET_BUCKET=player-photos-dev
npm run storage:copy
```

Si es el mismo proyecto Supabase, podes usar la misma URL/KEY en source y target, cambiando solo bucket origen/destino.

El script esta en `scripts/copy-storage-bucket.mjs`.

## Migrar datos existentes de public a app_prod/app_dev

Archivo listo para usar:

- `supabase/generated/data.copy_public_to_schema.sql`

Uso:

1. Abri el archivo.
2. Cambia `target_schema := 'app_prod'` y ejecuta.
3. Volve a ejecutar cambiando `target_schema := 'app_dev'`.

## Migrar fotos existentes a nuevo path por schema

Para que queden con formato nuevo (`<schema>/<org>/<player>.webp`):

Prod (mismo bucket):

```bash
SUPABASE_COPY_SOURCE_URL=...
SUPABASE_COPY_SOURCE_SERVICE_ROLE_KEY=...
SUPABASE_COPY_TARGET_URL=...
SUPABASE_COPY_TARGET_SERVICE_ROLE_KEY=...
SUPABASE_COPY_SOURCE_BUCKET=player-photos
SUPABASE_COPY_TARGET_BUCKET=player-photos
SUPABASE_COPY_TARGET_PREFIX=app_prod
npm run storage:copy
```

Dev (bucket separado):

```bash
SUPABASE_COPY_SOURCE_URL=...
SUPABASE_COPY_SOURCE_SERVICE_ROLE_KEY=...
SUPABASE_COPY_TARGET_URL=...
SUPABASE_COPY_TARGET_SERVICE_ROLE_KEY=...
SUPABASE_COPY_SOURCE_BUCKET=player-photos
SUPABASE_COPY_TARGET_BUCKET=player-photos-dev
SUPABASE_COPY_TARGET_PREFIX=app_dev
npm run storage:copy
```
