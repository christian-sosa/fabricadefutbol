export const GROWTH_EVENT_QUERY_PARAM = "ff_event";
export const GROWTH_EVENT_SOURCE_QUERY_PARAM = "ff_source";

export const GROWTH_EVENTS = {
  billingStarted: "billing_started",
  ctaClicked: "cta_clicked",
  groupCreated: "group_created",
  groupShared: "group_shared",
  matchCreated: "match_created",
  matchShared: "match_shared",
  paymentReturned: "payment_returned",
  playersPageOpened: "players_page_opened",
  rankingShared: "ranking_shared",
  signupStarted: "signup_started"
} as const;

export type GrowthEventName = (typeof GROWTH_EVENTS)[keyof typeof GROWTH_EVENTS];

const GROWTH_EVENT_NAMES = new Set<string>(Object.values(GROWTH_EVENTS));

export function isGrowthEventName(value: string | null | undefined): value is GrowthEventName {
  return Boolean(value && GROWTH_EVENT_NAMES.has(value));
}

function splitHash(path: string) {
  const hashIndex = path.indexOf("#");
  if (hashIndex === -1) {
    return { beforeHash: path, hash: "" };
  }

  return {
    beforeHash: path.slice(0, hashIndex),
    hash: path.slice(hashIndex)
  };
}

function appendQueryParams(path: string, params: Record<string, string>) {
  const { beforeHash, hash } = splitHash(path);
  const [basePath, queryString = ""] = beforeHash.split("?");
  const query = new URLSearchParams(queryString);

  for (const [key, value] of Object.entries(params)) {
    query.set(key, value);
  }

  const nextQuery = query.toString().replace(/\+/g, "%20");
  return `${basePath}${nextQuery ? `?${nextQuery}` : ""}${hash}`;
}

export function withGrowthEvent(
  path: string,
  eventName: GrowthEventName,
  source = "server"
) {
  return appendQueryParams(path, {
    [GROWTH_EVENT_QUERY_PARAM]: eventName,
    [GROWTH_EVENT_SOURCE_QUERY_PARAM]: source
  });
}

export function withShareTracking(path: string, content: string) {
  return appendQueryParams(path, {
    utm_source: "whatsapp",
    utm_medium: "share",
    utm_campaign: "group_growth",
    utm_content: content
  });
}
