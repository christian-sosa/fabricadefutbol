// Constantes y helpers para la cookie de "organizacion activa".
// La cookie se setea en el proxy de Next cuando el usuario visita una URL con
// `?org=<slug>`, y se usa como fallback en `resolvePublicOrganization` cuando
// el query param no esta presente. No contiene datos sensibles (solo slug
// publico), por lo que puede ser leida desde el cliente si hiciera falta.

export const ACTIVE_ORG_COOKIE = "fdf_active_org";

// 60 dias en segundos.
export const ACTIVE_ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 60;
