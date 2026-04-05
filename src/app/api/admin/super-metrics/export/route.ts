import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth/admin";
import { getSuperAdminDashboardMetrics } from "@/lib/queries/admin";

function csvCell(value: string | number) {
  const safeValue = String(value ?? "");
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function toCsv(rows: Array<Array<string | number>>) {
  return rows.map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\n");
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return new NextResponse("No autenticado.", { status: 401 });
  }

  if (!admin.isSuperAdmin) {
    return new NextResponse("Solo el super admin puede exportar estas metricas.", { status: 403 });
  }

  const metrics = await getSuperAdminDashboardMetrics();
  const dateStamp = new Date().toISOString().slice(0, 10);

  const summaryRows: Array<Array<string | number>> = [
    ["section", "metric", "value"],
    ["meta", "generated_at", metrics.generatedAt],
    ["totals", "organizations", metrics.totals.organizations],
    ["totals", "admins", metrics.totals.admins],
    ["totals", "org_admin_memberships", metrics.totals.orgAdminMemberships],
    ["totals", "pending_invites", metrics.totals.pendingInvites],
    ["totals", "players", metrics.totals.players],
    ["totals", "active_players", metrics.totals.activePlayers],
    ["totals", "inactive_players", metrics.totals.inactivePlayers],
    ["totals", "matches", metrics.totals.matches],
    ["totals", "draft_matches", metrics.totals.draftMatches],
    ["totals", "confirmed_matches", metrics.totals.confirmedMatches],
    ["totals", "finished_matches", metrics.totals.finishedMatches],
    ["totals", "cancelled_matches", metrics.totals.cancelledMatches],
    ["totals", "match_results", metrics.totals.matchResults],
    ["totals", "match_guests", metrics.totals.matchGuests],
    ["derived", "avg_players_per_organization", metrics.derived.avgPlayersPerOrganization],
    ["derived", "avg_matches_per_organization", metrics.derived.avgMatchesPerOrganization],
    ["derived", "completion_rate_percent", metrics.derived.completionRatePercent],
    ["derived", "organizations_without_players", metrics.derived.organizationsWithoutPlayers],
    ["derived", "organizations_without_admins", metrics.derived.organizationsWithoutAdmins],
    ["last_30_days", "organizations_created", metrics.last30Days.organizationsCreated],
    ["last_30_days", "players_created", metrics.last30Days.playersCreated],
    ["last_30_days", "matches_created", metrics.last30Days.matchesCreated],
    ["last_30_days", "matches_finished", metrics.last30Days.matchesFinished]
  ];

  const orgRows: Array<Array<string | number>> = [
    [
      "organization_id",
      "name",
      "slug",
      "players",
      "active_players",
      "matches",
      "finished_matches",
      "admins",
      "pending_invites",
      "created_at"
    ],
    ...metrics.organizationsBreakdown.map((organization) => [
      organization.id,
      organization.name,
      organization.slug,
      organization.players,
      organization.activePlayers,
      organization.matches,
      organization.finishedMatches,
      organization.admins,
      organization.pendingInvites,
      organization.createdAt
    ])
  ];

  const csvContent = `${toCsv(summaryRows)}\n\n${toCsv(orgRows)}\n`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="super-admin-metrics-${dateStamp}.csv"`,
      "cache-control": "no-store"
    }
  });
}
