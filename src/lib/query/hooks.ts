"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchOrganizationMatches, fetchOrganizationStandings, updateMatchResult } from "@/lib/query/client";
import { organizationQueryKeys } from "@/lib/query/keys";
import type { MatchHistoryItem, UpdateMatchResultPayload } from "@/lib/query/types";
import type { PlayerComputedStats } from "@/types/domain";

const ORGANIZATION_QUERY_STALE_TIME = 60_000;

export function useOrganizationStandingsQuery(params: {
  organizationId: string | null | undefined;
  initialData?: PlayerComputedStats[];
}) {
  const organizationId = params.organizationId ?? null;

  return useQuery({
    queryKey: organizationId ? organizationQueryKeys.standings(organizationId) : ["organizations", "none", "standings"],
    queryFn: () => fetchOrganizationStandings(organizationId as string),
    enabled: Boolean(organizationId),
    initialData: params.initialData,
    staleTime: ORGANIZATION_QUERY_STALE_TIME,
    placeholderData: keepPreviousData
  });
}

export function useOrganizationMatchesQuery(params: {
  organizationId: string | null | undefined;
  initialData?: MatchHistoryItem[];
}) {
  const organizationId = params.organizationId ?? null;

  return useQuery({
    queryKey: organizationId ? organizationQueryKeys.matches(organizationId) : ["organizations", "none", "matches"],
    queryFn: () => fetchOrganizationMatches(organizationId as string),
    enabled: Boolean(organizationId),
    initialData: params.initialData,
    staleTime: ORGANIZATION_QUERY_STALE_TIME,
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
          queryKey: organizationQueryKeys.matches(organizationId),
          exact: true
        }),
        queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.standings(organizationId),
          exact: true
        }),
        queryClient.invalidateQueries({
          queryKey: organizationQueryKeys.matchDetail(organizationId, matchId),
          exact: true
        })
      ]);
    }
  });
}
