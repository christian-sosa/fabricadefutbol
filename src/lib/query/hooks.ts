"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchOrganizationMatches, fetchOrganizationStandings, updateMatchResult } from "@/lib/query/client";
import { organizationQueryKeys } from "@/lib/query/keys";
import type { OrganizationMatchesResponse, UpdateMatchResultPayload } from "@/lib/query/types";
import type { PlayerComputedStats } from "@/types/domain";

const ORGANIZATION_QUERY_STALE_TIME = 60_000;

export function useOrganizationStandingsQuery(params: {
  organizationId: string | null | undefined;
  season?: string;
  initialData?: PlayerComputedStats[];
}) {
  const organizationId = params.organizationId ?? null;
  const season = params.season ?? "current";

  return useQuery({
    queryKey: organizationId ? organizationQueryKeys.standings(organizationId, season) : ["organizations", "none", "standings", season],
    queryFn: ({ signal }) => fetchOrganizationStandings(organizationId as string, season, signal),
    enabled: Boolean(organizationId),
    initialData: params.initialData,
    staleTime: ORGANIZATION_QUERY_STALE_TIME,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true
  });
}

export function useOrganizationMatchesQuery(params: {
  organizationId: string | null | undefined;
  page: number;
  pageSize?: number;
  season?: string;
  initialData?: OrganizationMatchesResponse;
}) {
  const organizationId = params.organizationId ?? null;
  const page = params.page;
  const pageSize = params.pageSize ?? 10;
  const season = params.season ?? "current";

  return useQuery({
    queryKey: organizationId
      ? organizationQueryKeys.matchesPage(organizationId, page, pageSize, season)
      : ["organizations", "none", "matches", page, pageSize, season],
    queryFn: ({ signal }) =>
      fetchOrganizationMatches({
        organizationId: organizationId as string,
        page,
        pageSize,
        season
      }, signal),
    enabled: Boolean(organizationId),
    initialData: params.initialData,
    staleTime: ORGANIZATION_QUERY_STALE_TIME,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    placeholderData: (previousData, previousQuery) => {
      const previousKey = previousQuery?.queryKey;
      const previousScope = previousKey?.[3] as { pageSize?: number; season?: string } | undefined;
      return previousKey?.[1] === organizationId && previousScope?.season === season && previousScope.pageSize === pageSize
        ? previousData
        : undefined;
    }
  });
}

export function useUpdateMatchResultMutation(params: { organizationId: string; matchId: string }) {
  const queryClient = useQueryClient();
  const { organizationId, matchId } = params;

  return useMutation({
    mutationFn: (payload: UpdateMatchResultPayload) =>
      updateMatchResult({
        organizationId,
        matchId,
        payload
      }),
    onSuccess: async () => {
      // This prefix includes standings, history pages and match details. Overlapping
      // invalidations cancel and restart the same active reads multiple times.
      await queryClient.invalidateQueries({
        queryKey: organizationQueryKeys.byId(organizationId)
      });
    }
  });
}
