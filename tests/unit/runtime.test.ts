import { describe, expect, it } from "vitest";
import { assertSupportedRuntime } from "../../scripts/lib/runtime.mjs";

describe("supported test runtime", () => {
  it.each(["v24.19.0", "24.19.1", "v24.20.0"])("accepts %s within the declared major", (version) => {
    expect(() => assertSupportedRuntime(version, "24.19.0")).not.toThrow();
  });
  it.each(["v20.17.0", "v24.18.9", "v25.0.0", "v24.19.0-rc.1", "invalid"])("rejects %s before loading test dependencies", (version) => {
    expect(() => assertSupportedRuntime(version, "24.19.0")).toThrow("Node incompatible");
  });
  it("reports an invalid minimum instead of silently accepting any runtime", () => {
    expect(() => assertSupportedRuntime("v24.19.0", "invalid")).toThrow(".nvmrc");
  });
});
