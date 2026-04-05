export const organizationQueryKeys = {
  all: ["organizations"] as const,
  byId: (organizationId: string) => [...organizationQueryKeys.all, organizationId] as const,
  matches: (organizationId: string) => [...organizationQueryKeys.byId(organizationId), "matches"] as const,
  standings: (organizationId: string) => [...organizationQueryKeys.byId(organizationId), "standings"] as const,
  matchDetail: (organizationId: string, matchId: string) =>
    [...organizationQueryKeys.byId(organizationId), "matches", matchId] as const
};
