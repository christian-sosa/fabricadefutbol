import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("tournament creation action", () => {
  it("valida super admin antes de iniciar pagos o checkouts", () => {
    const source = readFileSync(
      path.join(root, "src", "app", "admin", "(panel)", "tournaments", "actions.ts"),
      "utf8"
    );

    const adminIndex = source.indexOf("const admin = await assertAdminAction();");
    const gateIndex = source.indexOf("await assertCanCreateLeagueAction(admin);");
    const paymentClientIndex = source.indexOf("const supabaseAdmin = createSupabaseAdminClient();");

    expect(adminIndex).toBeGreaterThanOrEqual(0);
    expect(gateIndex).toBeGreaterThan(adminIndex);
    expect(paymentClientIndex).toBeGreaterThan(gateIndex);
  });
});
