// tests/unit/obfuscation.test.ts
import { describe, it, expect } from "vitest";
import {
  quantizeWeight,
  obfuscateNeighbor,
  obfuscateResponse,
} from "../../src/security/obfuscation.js";

describe("quantizeWeight", () => {
  it("maps weight to signed quantile rank 1-5", () => {
    expect(quantizeWeight(0.9)).toBe(5);
    expect(quantizeWeight(0.3)).toBeGreaterThanOrEqual(2);
    expect(quantizeWeight(0.3)).toBeLessThanOrEqual(4);
    expect(quantizeWeight(-0.5)).toBeLessThan(0);
    expect(Math.abs(quantizeWeight(0.01))).toBe(1);
  });

  it("returns 0 for exactly 0", () => {
    expect(quantizeWeight(0)).toBe(0);
  });
});

describe("obfuscateNeighbor", () => {
  const neighbor = {
    node_id: "ETH",
    node_name: "ETH",
    node_type: "asset_price",
    domain: "crypto",
    edge_type: "directed_lagged",
    weight: 0.35,
    tau: 2,
    tau_duration: "PT2H",
    current_value: 3200,
    current_change_percent: 1.5,
  };

  it("keeps everything at raw level", () => {
    const result = obfuscateNeighbor(neighbor, "raw");
    expect(result["weight"]).toBe(0.35);
    expect(result["tau"]).toBe(2);
    expect(result["current_value"]).toBe(3200);
  });

  it("quantizes weight at full level", () => {
    const result = obfuscateNeighbor(neighbor, "full");
    expect(result["weight"]).toBeGreaterThanOrEqual(1);
    expect(result["weight"]).toBeLessThanOrEqual(5);
    expect(typeof result["weight"]).toBe("number");
    expect(result["tau"]).toBe(2);
  });

  it("removes weight/tau/values at summary level", () => {
    const result = obfuscateNeighbor(neighbor, "summary");
    expect(result["weight"]).toBeUndefined();
    expect(result["tau"]).toBeUndefined();
    expect(result["tau_duration"]).toBeUndefined();
    expect(result["current_value"]).toBeUndefined();
    expect(result["current_change_percent"]).toBeUndefined();
    expect(result["node_id"]).toBe("ETH");
    expect(result["edge_type"]).toBe("directed_lagged");
  });
});

describe("obfuscateResponse", () => {
  it("returns response as-is for raw", () => {
    const response = { neighbors: [{ weight: 0.35, node_id: "ETH" }] };
    const result = obfuscateResponse(response, "raw");
    expect(result).toEqual(response);
  });

  it("obfuscates neighbors array at full level", () => {
    const response = {
      neighbors: [
        { node_id: "ETH", weight: 0.35, tau: 2, tau_duration: "PT2H" },
      ],
    };
    const result = obfuscateResponse(response, "full");
    const neighbors = result["neighbors"] as Array<Record<string, unknown>>;
    expect(neighbors[0]["node_id"]).toBe("ETH");
    expect(typeof neighbors[0]["weight"]).toBe("number");
    expect(neighbors[0]["weight"] as number).toBeGreaterThanOrEqual(1);
    expect(neighbors[0]["weight"] as number).toBeLessThanOrEqual(5);
  });

  it("obfuscates causal_features array at full level", () => {
    const response = {
      causal_features: [
        { node_id: "ETH", weight: 0.35, impact: 0.012, impact_fraction: 0.6 },
      ],
    };
    const result = obfuscateResponse(response, "full");
    const features = result["causal_features"] as Array<Record<string, unknown>>;
    expect(typeof features[0]["weight"]).toBe("number");
    expect(features[0]["impact"]).toBe(0.012);
  });

  it("strips sensitive fields at summary level", () => {
    const response = {
      causal_features: [
        { node_id: "ETH", weight: 0.35, impact: 0.012, tau: 2 },
      ],
      estimate: {
        value: 0.023,
        direction: "up",
        probability_positive: 0.72,
        confidence_interval: [0.005, 0.041],
      },
    };
    const result = obfuscateResponse(response, "summary");
    const features = result["causal_features"] as Array<Record<string, unknown>>;
    expect(features[0]["weight"]).toBeUndefined();
    expect(features[0]["impact"]).toBeUndefined();
    expect(features[0]["tau"]).toBeUndefined();
    expect(features[0]["node_id"]).toBe("ETH");
    const estimate = result["estimate"] as Record<string, unknown>;
    expect(estimate["direction"]).toBe("up");
    expect(estimate["probability_positive"]).toBe(0.72);
    expect(estimate["value"]).toBe(0.023);
    expect(estimate["confidence_interval"]).toBeUndefined();
  });

  it("removes paths array entirely at summary level", () => {
    const response = {
      paths: [[{ from: "A", to: "B", weight: 0.5 }]],
    };
    const result = obfuscateResponse(response, "summary");
    expect(result["paths"]).toBeUndefined();
  });

  it("§9.2 obfuscates effects array items (intervene.do responses)", () => {
    const response = {
      effects: [
        {
          target: "ETH",
          expected_change: 0.02,
          weight: 0.35,
          tau: 2,
          causal_path: [{ from: "BTC", to: "ETH", weight: 0.5 }],
          reasoning_mode: "scm_simulation",
        },
      ],
    };
    // Full: quantize weights in effects
    const full = obfuscateResponse(response, "full");
    const fullEffects = full["effects"] as Array<Record<string, unknown>>;
    expect(typeof fullEffects[0]["weight"]).toBe("number");

    // Summary: strip causal_path from effects
    const summary = obfuscateResponse(response, "summary");
    const summaryEffects = summary["effects"] as Array<Record<string, unknown>>;
    expect(summaryEffects[0]["causal_path"]).toBeUndefined();
    expect(summaryEffects[0]["target"]).toBe("ETH");
    expect(summaryEffects[0]["reasoning_mode"]).toBe("scm_simulation");
  });
});
