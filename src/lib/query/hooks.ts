"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
    queryFn: () => fetchOrganizationStandings(organizationId as string, season),
    enabled: Boolean(organizationId),
    initialData: params.initialData,
    staleTime: ORGANIZATION_QUERY_STALE_TIME,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData
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
    queryFn: () =>
      fetchOrganizationMatches({
        organizationId: organizationId as string,
        page,
        pageSize,
        season
      }),
    enabled: Boolean(organizationId),
    initialData: params.initialData,
    staleTime: ORGANIZATION_QUERY_STALE_TIME,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData
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
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.matches(organizationId)
        }),
        queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.byId(organizationId)
        }),
        queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.matchDetail(organizationId, matchId),
          exact: true
        })
      ]);
    }
  });
}
