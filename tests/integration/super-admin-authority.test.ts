import type { User } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getSessionIsSuperAdmin } from "@/lib/auth/super-admin";
import { requiresMfaVerification } from "@/lib/auth/mfa";

describe("authoritative superadmin and MFA", () => {
  it("grants authority only for a positive database decision", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const client = { rpc } as unknown as Parameters<typeof getSessionIsSuperAdmin>[0];
    expect(await getSessionIsSuperAdmin(client)).toBe(true);
    expect(rpc).toHaveBeenCalledWith("is_super_admin");
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await getSessionIsSuperAdmin(client)).toBe(false);
    rpc.mockResolvedValue({ data: "true", error: null });
    expect(await getSessionIsSuperAdmin(client)).toBe(false);
    rpc.mockResolvedValue({ data: true, error: { message: "offline" } });
    await expect(getSessionIsSuperAdmin(client)).rejects.toThrow("permisos");
  });
  it("does not block users who have not activated MFA", async () => {
    const getAuthenticatorAssuranceLevel = vi.fn();
    const client = { auth: { mfa: { getAuthenticatorAssuranceLevel } } } as unknown as Parameters<typeof requiresMfaVerification>[0];
    expect(await requiresMfaVerification(client, { factors: [{ status: "unverified" }] } as User)).toBe(false);
    expect(getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });
  it("requires the second factor on enrolled accounts, including on errors", async () => {
    const getAuthenticatorAssuranceLevel = vi.fn().mockResolvedValue({ data: { currentLevel: "aal1" }, error: null });
    const client = { auth: { mfa: { getAuthenticatorAssuranceLevel } } } as unknown as Parameters<typeof requiresMfaVerification>[0];
    const user = { factors: [{ status: "verified" }] } as User;
    expect(await requiresMfaVerification(client, user)).toBe(true);
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2" }, error: null });
    expect(await requiresMfaVerification(client, user)).toBe(false);
    getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(requiresMfaVerification(client, user)).rejects.toThrow("segundo factor");
  });
});
