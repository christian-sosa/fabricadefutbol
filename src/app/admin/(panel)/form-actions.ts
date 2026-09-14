"use server";

import { createOrganizationAction, uploadOrganizationImageAction } from "./actions";
import { bulkUpdatePlayersAction, createPlayerAction, uploadPlayerPhotoAction } from "./players/actions";
import { createMatchAction } from "./matches/new/actions";
import { formActionResult } from "@/lib/form-action-result";

export async function createPlayerFormAction(data: FormData) { return formActionResult(createPlayerAction, data, "/admin/players"); }
export async function updatePlayersFormAction(data: FormData) { return formActionResult(bulkUpdatePlayersAction, data, "/admin/players"); }
export async function uploadPlayerPhotoFormAction(data: FormData) { return formActionResult(uploadPlayerPhotoAction, data, "/admin/players"); }
export async function createMatchFormAction(data: FormData) { return formActionResult(createMatchAction, data, "/admin/matches/new"); }
export async function uploadOrganizationImageFormAction(data: FormData) { return formActionResult(uploadOrganizationImageAction, data, "/admin"); }
export async function createOrganizationFormAction(data: FormData) { return formActionResult(createOrganizationAction, data, "/admin"); }
