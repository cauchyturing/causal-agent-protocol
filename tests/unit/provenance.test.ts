import { describe, it, expect } from "vitest";
import { buildProvenance } from "../../src/cap/provenance.js";

describe("buildProvenance", () => {
  it("returns all required fields", () => {
    const p = buildProvenance({
      graphVersion: "dynamic",
      graphTimestamp: "2026-03-12T00:00:00Z",
      computationTimeMs: 42,
    });
    expect(p.algorithm).toBe("PCMCI");
    expect(p.graph_version).toBe("dynamic");
    expect(p.graph_timestamp).toBe("2026-03-12T00:00:00Z");
    expect(p.computation_time_ms).toBe(42);
    expect(p.server_name).toBe("Abel Social Physical Engine");
    expect(p.server_version).toBeDefined();
    expect(p.cap_spec_version).toBe("0.2.2");
  });

  it("includes optional fields when provided", () => {
    const p = buildProvenance({
      graphVersion: "v1",
      graphTimestamp: "2026-03-12T00:00:00Z",
      computationTimeMs: 10,
      sampleSize: 1000,
      mechanismFamilyUsed: "linear",
      mechanismModelVersion: "2.0",
    });
    expect(p.sample_size).toBe(1000);
    expect(p.mechanism_family_used).toBe("linear");
    expect(p.mechanism_model_version).toBe("2.0");
  });

  it("omits optional fields when not provided", () => {
    const p = buildProvenance({
      graphVersion: "dynamic",
      graphTimestamp: "2026-03-12T00:00:00Z",
      computationTimeMs: 5,
    });
    expect(p.sample_size).toBeUndefined();
    expect(p.mechanism_family_used).toBeUndefined();
    expect(p.mechanism_model_version).toBeUndefined();
  });
});
