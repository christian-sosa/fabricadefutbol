import type {
  OrganizationMatchesResponse,
  OrganizationStandingsResponse,
  UpdateMatchResultPayload,
  UpdateMatchResultResponse
} from "@/lib/query/types";

async function parseApiError(response: Response) {
  const fallbackMessage = `Request failed with status ${response.status}`;
  try {
    const json = (await response.json()) as { error?: string };
    if (typeof json.error === "string" && json.error.trim().length) {
      return json.error;
    }
  } catch {
    return fallbackMessage;
  }
  return fallbackMessage;
}

export async function fetchOrganizationStandings(organizationId: string) {
  const response = await fetch(`/api/organizations/${organizationId}/standings`, {
    method: "GET",
    headers: {
      "content-type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as OrganizationStandingsResponse;
  return data.standings;
}

export async function fetchOrganizationMatches(organizationId: string) {
  const response = await fetch(`/api/organizations/${organizationId}/matches`, {
    method: "GET",
    headers: {
      "content-type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const data = (await response.json()) as OrganizationMatchesResponse;
  return data.matches;
}

export async function updateMatchResult(params: {
  organizationId: string;
  matchId: string;
  payload: UpdateMatchResultPayload;
}) {
  const response = await fetch(
    `/api/admin/organizations/${params.organizationId}/matches/${params.matchId}/result`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(params.payload)
    }
  );

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  return (await response.json()) as UpdateMatchResultResponse;
}
