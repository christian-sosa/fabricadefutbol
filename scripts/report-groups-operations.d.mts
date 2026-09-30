import type { SupabaseClient } from "@supabase/supabase-js";

export type OperationsCosts = {
  currency?: string;
  monthlyInfrastructureCost?: number;
  monthlyEmailCost?: number;
  monthlyEmailCount?: number;
  monthlySupportMinutes?: number;
  supportHourlyCost?: number;
};
export type OperationsConfiguration = {
  target: "development" | "production";
  schema: "app_dev" | "app_prod";
  url: string;
  key: string;
  photosBucket: string;
  imagesBucket: string;
};
type StorageUsage = {
  objects: number;
  playerPhotoObjects: number;
  organizationImageObjects: number;
  measuredBytes: number;
  objectsWithUnknownSize: number;
  bytes: number | null;
};
type GroupUsage = {
  groupNumber: number;
  archived: boolean;
  activeLast30Days: boolean;
  players: number;
  activePlayers: number;
  playersWithPhoto: number;
  finishedMatchesLast30Days: number;
  storage: StorageUsage;
};
export type OperationsReport = {
  generatedAt: string;
  target: string;
  schema: string;
  activityWindow: { from: string; to: string; days: number; definition: string };
  scope: string;
  totals: { groups: number; activeGroups: number; archivedGroups: number; players: number; activePlayers: number; playersWithPhoto: number; finishedMatchesLast30Days: number; storage: StorageUsage; unattributedStorage: StorageUsage };
  groups: GroupUsage[];
  economics: {
    basis: string;
    currency: string | null;
    monthlyInfrastructureCost: number | null;
    monthlyEmailCost: number | null;
    monthlyEmailCount: number | null;
    monthlySupportMinutes: number | null;
    supportHourlyCost: number | null;
    monthlySupportCost: number | null;
    monthlyOperatingCost: number | null;
    monthlyOperatingCostPerActiveGroup: number | null;
    monthlyInfrastructureCostPerActiveGroup: number | null;
    monthlyEmailCostPerActiveGroup: number | null;
    monthlySupportCostPerActiveGroup: number | null;
    monthlyEmailCountPerActiveGroup: number | null;
    monthlySupportMinutesPerActiveGroup: number | null;
    missingInputs: string[];
  };
};
export function parseOperationsArguments(args: string[]): { help: boolean; envFile: string | null; costs: OperationsCosts };
export function resolveOperationsConfiguration(): Promise<OperationsConfiguration>;
export function listStorageObjects(storage: { from(bucket: string): { list(path: string, options: { limit: number; offset: number; sortBy: { column: string; order: string } }): PromiseLike<{ data: Array<{ id: string | null; name: string; metadata?: { size?: unknown } | null }> | null; error: unknown }> } }, bucket: string, prefix: string): Promise<Array<{ bucket: string; path: string; size: unknown }>>;
export function buildGroupsOperationsReport(input: {
  organizations: Array<{ id: string; archived_at?: string | null }>;
  players: Array<{ organization_id: string; active: boolean; photo_path?: string | null }>;
  matches: Array<{ organization_id: string; status: string; finished_at: string }>;
  objects: Array<{ bucket: string; path: string; size?: unknown }>;
  schema: string; target: string; now?: Date; costs?: OperationsCosts;
}): OperationsReport;
export function collectGroupsOperationsReport(input: { client: SupabaseClient; configuration: OperationsConfiguration; now?: Date; costs?: OperationsCosts }): Promise<OperationsReport>;
