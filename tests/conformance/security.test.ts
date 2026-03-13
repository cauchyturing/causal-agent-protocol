// tests/conformance/security.test.ts
import { describe, it, expect } from "vitest";
import { checkVerbAccess, getResponseDetail } from "../../src/security/tiers.js";
import { obfuscateResponse, quantizeWeight } from "../../src/security/obfuscation.js";

describe("§9.1 Access tier conformance", () => {
  it("public tier MUST only allow declared verbs", () => {
    expect(checkVerbAccess("observe.predict", "public")).toBe(true);
    expect(checkVerbAccess("traverse.parents", "public")).toBe(true);
    expect(checkVerbAccess("meta.health", "public")).toBe(true);
    expect(checkVerbAccess("meta.capabilities", "public")).toBe(true);
    expect(checkVerbAccess("graph.neighbors", "public")).toBe(false);
    expect(checkVerbAccess("effect.query", "public")).toBe(false);
    expect(checkVerbAccess("intervene.do", "public")).toBe(false);
  });

  it("detail level maps correctly to tiers", () => {
    expect(getResponseDetail("public")).toBe("summary");
    expect(getResponseDetail("standard")).toBe("full");
    expect(getResponseDetail("enterprise")).toBe("raw");
  });
});

describe("§9.2 Progressive disclosure conformance", () => {
  it("summary level MUST hide weights, taus, CIs", () => {
    const response = {
      neighbors: [{ node_id: "ETH", weight: 0.35, tau: 2, tau_duration: "PT2H" }],
      estimate: {
        value: 0.023,
        direction: "up",
        probability_positive: 0.72,
        confidence_interval: [0.005, 0.041],
      },
    };
    const result = obfuscateResponse(response, "summary");
    const n = (result["neighbors"] as Array<Record<string, unknown>>)[0];
    expect(n["weight"]).toBeUndefined();
    expect(n["tau"]).toBeUndefined();
    const e = result["estimate"] as Record<string, unknown>;
    expect(e["confidence_interval"]).toBeUndefined();
    expect(e["direction"]).toBe("up");
    expect(e["probability_positive"]).toBe(0.72);
  });

  it("full level MUST quantize weights", () => {
    const q = quantizeWeight(0.35);
    expect(q).toBeGreaterThanOrEqual(1);
    expect(q).toBeLessThanOrEqual(5);
    expect(Number.isInteger(q)).toBe(true);
  });

  it("raw level MUST return unmodified data", () => {
    const response = { neighbors: [{ weight: 0.35, tau: 2 }] };
    const result = obfuscateResponse(response, "raw");
    expect(result).toEqual(response);
  });
});
