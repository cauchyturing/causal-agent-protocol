import { describe, it, expect } from "vitest";
import {
  transformFeatureToCausal,
  transformChildToNeighbor,
  computeImpactFractions,
} from "../../src/abel-client/transformers.js";
import type { AbelFeature, AbelChild } from "../../src/abel-client/types.js";

describe("transformers", () => {
  describe("transformFeatureToCausal", () => {
    it("maps Abel feature to CausalFeature", () => {
      const feature: AbelFeature = {
        feature_name: "ETH",
        feature_type: "asset_price",
        weight: 0.35,
        tau: 2,
        current_value: 3200,
        current_change_percent: 1.5,
        impact: 0.012,
      };
      const result = transformFeatureToCausal(feature);
      expect(result.node_id).toBe("ETH");
      expect(result.edge_type).toBe("directed_lagged");
      expect(result.tau).toBe(2);
      expect(result.tau_duration).toBe("PT2H");
      expect(result.impact).toBe(0.012);
      expect(result.weight).toBe(0.35);
    });

    it("computes impact from weight * change when impact not provided", () => {
      const feature: AbelFeature = {
        feature_name: "SOL",
        feature_type: "asset_price",
        weight: 0.2,
        tau: 1,
        current_change_percent: 3.0,
      };
      const result = transformFeatureToCausal(feature);
      expect(result.impact).toBeCloseTo(0.6);
    });
  });

  describe("transformChildToNeighbor", () => {
    it("maps Abel child to neighbor format", () => {
      const child: AbelChild = {
        child_name: "LINK",
        child_type: "asset_price",
        weight: 0.15,
        tau: 3,
      };
      const result = transformChildToNeighbor(child);
      expect(result.node_id).toBe("LINK");
      expect(result.tau_duration).toBe("PT3H");
      expect(result.domain).toBe("crypto");
    });
  });

  describe("computeImpactFractions", () => {
    it("normalizes impact fractions to sum to 1", () => {
      const features = [
        { ...makeFeature(), impact: 3 },
        { ...makeFeature(), impact: -1 },
        { ...makeFeature(), impact: 2 },
      ];
      computeImpactFractions(features);
      const sum = features.reduce((s, f) => s + f.impact_fraction, 0);
      expect(sum).toBeCloseTo(1.0);
    });

    it("handles all-zero impacts gracefully", () => {
      const features = [
        { ...makeFeature(), impact: 0 },
        { ...makeFeature(), impact: 0 },
      ];
      computeImpactFractions(features);
      expect(features[0]!.impact_fraction).toBe(0);
    });
  });
});

function makeFeature() {
  return {
    node_id: "X",
    node_name: "X",
    node_type: "asset_price",
    edge_type: "directed_lagged",
    impact: 0,
    impact_fraction: 0,
    weight: 0,
    tau: 1,
    tau_duration: "PT1H",
  };
}
