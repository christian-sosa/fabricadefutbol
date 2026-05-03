export const organizationQueryKeys = {
  all: ["organizations"] as const,
  byId: (organizationId: string) => [...organizationQueryKeys.all, organizationId] as const,
  matches: (organizationId: string) => [...organizationQueryKeys.byId(organizationId), "matches"] as const,
  matchesPage: (organizationId: string, page: number, pageSize: number, season = "current") =>
    [...organizationQueryKeys.matches(organizationId), { page, pageSize, season }] as const,
  standings: (organizationId: string, season = "current") =>
    [...organizationQueryKeys.byId(organizationId), "standings", { season }] as const,
  matchDetail: (organizationId: string, matchId: string) =>
    [...organizationQueryKeys.byId(organizationId), "matches", matchId] as const
};
