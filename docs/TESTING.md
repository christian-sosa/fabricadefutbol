# Testing Automatico

## Objetivo

Este sistema de tests busca darte una red de seguridad real para trabajar con una sola rama.
La regla operativa es simple:

- despues de cada cambio corre `npm run verify`
- antes de cambios sensibles o antes de publicar corre `npm run verify:smoke`

Si ambos pasan, el riesgo de romper produccion baja mucho. No lo elimina por completo, pero deja cubiertos los modulos mas delicados del negocio, la UI critica y un flujo E2E chico pero valioso.

## Stack elegido

- `Vitest` para unitarios e integracion hermetica
- `React Testing Library` para formularios cliente con logica sensible
- `Playwright` para smoke E2E real contra un entorno de test separado
- `Husky` para bloquear pushes locales si `verify` falla
- `GitHub Actions` como segunda red de seguridad remota

## Prerequisitos

- Node `20.19.0`
- `npm`
- para E2E: un `.env.test` apuntando a un Supabase de test
- para Playwright local: instalar Chromium una vez con `npx playwright install chromium`

El repo ya incluye `.nvmrc`, asi que puedes alinear tu runtime con:

```bash
nvm use
```

## Instalacion

```bash
npm install
```

La instalacion corre `prepare` y deja activo el hook local `pre-push`, que ejecuta:

```bash
npm run verify
```

## Comandos diarios

### Gate obligatorio local

```bash
npm run verify
```

Esto corre:

- `npm run lint`
- `npm run typecheck`
- `npm run test:coverage`
- `npm run build`

### Smoke completo antes de publicar

```bash
npm run verify:smoke
```

Esto corre `verify` y despues `npm run test:e2e`.

## Comandos por capa

### Vitest completo

```bash
npm run test
```

### Vitest en watch

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:coverage
```

### Smoke E2E

```bash
npm run test:e2e
```

## Estructura

```txt
tests/
  unit/
  integration/
  ui/
  e2e/
  helpers/
  setup/
```

## Como configurar `.env.test`

1. Copia `.env.test.example` a `.env.test`
2. apunta todas las credenciales a un entorno de test, nunca a produccion
3. usa un schema y datos separados de desarrollo diario si es posible

Variables minimas:

- `SUPABASE_TARGET_ENV=development`
- `NEXT_PUBLIC_SUPABASE_URL_DEV`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY_DEV`
- `SUPABASE_SERVICE_ROLE_KEY_DEV`
- `NEXT_PUBLIC_SUPABASE_DB_SCHEMA_DEV`
- `SUPABASE_PLAYER_PHOTOS_BUCKET_DEV`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_ORG_SLUG`

`tests/e2e/global-setup.ts` usa esas variables para:

- crear o actualizar el admin de prueba
- asegurar una organizacion publica de smoke
- limpiar partidos previos de esa organizacion
- sembrar jugadores deterministas para el flujo E2E

## Coverage

La cobertura se genera en `coverage/`.

Salidas utiles:

- `coverage/index.html` para abrir el reporte visual
- `coverage/coverage-summary.json` para integraciones o lectura rapida

En esta primera version el foco no es una cobertura global artificial, sino asegurar los modulos criticos:

- dominio de partidos
- dominio de billing
- rate limit
- Mercado Pago
- resolucion publica de organizacion
- formularios admin sensibles

El gate de coverage bloquea por modulos endurecidos, no por un porcentaje global agregado.
Los archivos grandes de orquestacion que todavia no tienen cobertura pareja siguen apareciendo en el reporte, pero en v1 se usan como señal para seguir ampliando la suite sin meter un falso rojo por volumen.

## Como agregar un test nuevo

Usa esta regla simple:

- si la logica es pura y no toca IO: `tests/unit`
- si la logica orquesta base, env, cookies o webhooks con mocks/fakes: `tests/integration`
- si valida formularios, payloads o bloqueos del cliente: `tests/ui`
- si quieres validar un flujo real de punta a punta: `tests/e2e`

Prioriza primero negocio puro, despues integracion focalizada, despues UI y por ultimo E2E.

## Flujo recomendado despues de cada cambio

1. haz tu cambio
2. corre `npm run verify`
3. si tocaste auth, billing, partidos, webhooks o navegacion critica, corre `npm run verify:smoke`
4. recien ahi empuja

## CI en GitHub

El workflow vive en `.github/workflows/tests.yml` y tiene dos jobs:

- `quality`: lint, typecheck, coverage y build
- `e2e-smoke`: Playwright smoke solo si los secrets de test estan presentes

Artifacts:

- coverage
- reporte de Playwright si el smoke falla

## Troubleshooting

### `EBADENGINE` o warnings de engine

Tu Node local esta fuera del contrato esperado. Cambia a `20.19.0` con `nvm use`.

### Falla `test:e2e` por variables

Te falta completar `.env.test`. Revisa `.env.test.example`.

### Falla login en Playwright

Confirma que `SUPABASE_SERVICE_ROLE_KEY_DEV`, `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD` sean correctos y que el schema de test este expuesto.

### Falla el hook `pre-push`

No lo ignores. El objetivo es que no subas cambios con el gate roto. Corre `npm run verify`, corrige y vuelve a intentar.

## Advertencia honesta

Tests verdes reducen mucho el riesgo, pero no sustituyen:

- caidas externas de Supabase
- errores o demoras de Mercado Pago
- datos reales inconsistentes en produccion
- configuraciones de entorno mal cargadas

La definicion operativa de "no romper produccion" en este repo pasa por tres capas:

- `verify` obligatorio tras cada cambio
- smoke E2E en CI
- cobertura fuerte en modulos criticos de negocio
