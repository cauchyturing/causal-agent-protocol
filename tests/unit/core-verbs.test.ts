import { describe, it, expect } from "vitest";
import type { AbelClient } from "../../src/abel-client/client.js";
import type { Config } from "../../src/config.js";
import { metaCapabilitiesHandler } from "../../src/verbs/core/meta-capabilities.js";

describe("meta.capabilities", () => {
  it("returns capability card with correct conformance level", async () => {
    const result = await metaCapabilitiesHandler.handle(
      {},
      {} as unknown as AbelClient,
      { port: 3001 } as unknown as Config
    );
    expect(result.result["conformance_level"]).toBe(2);
    expect(result.result["cap_spec_version"]).toBe("0.2.2");
    expect(result.result["name"]).toBe("Abel Social Physical Engine");
  });

  it("includes structural_mechanisms in causal_engine", async () => {
    const result = await metaCapabilitiesHandler.handle(
      {},
      {} as unknown as AbelClient,
      { port: 3001 } as unknown as Config
    );
    const engine = result.result["causal_engine"] as Record<string, unknown>;
    const mechs = engine["structural_mechanisms"] as Record<string, unknown>;
    expect(mechs["available"]).toBe(true);
    expect(mechs["mechanism_override_supported"]).toBe(true);
  });
});
