import { describe, it, expect } from "vitest";
import {
  transformFeatureToCausal,
  transformChildToNeighbor,
  computeImpactFractions,
  transformInterveneEffect,
} from "../../src/abel-client/transformers.js";
import type { AbelFeature, AbelChild, AbelInterveneEffect } from "../../src/abel-client/types.js";

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

  describe("transformInterveneEffect", () => {
    it("converts propagation_delay_hours to ISO 8601 duration", () => {
      const effect: AbelInterveneEffect = {
        target: "ETH",
        expected_change: 0.05,
        unit: "log_return",
        probability_positive: 0.72,
        propagation_delay_hours: 2,
        mechanism_coverage_complete: true,
      };
      const result = transformInterveneEffect(effect);
      expect(result.propagation_delay).toBe("PT2H");
      expect((result as Record<string, unknown>).propagation_delay_hours).toBeUndefined();
    });

    it("adds interval_method bootstrap when confidence_interval is present", () => {
      const effect: AbelInterveneEffect = {
        target: "BTC",
        expected_change: 0.03,
        unit: "log_return",
        confidence_interval: [-0.01, 0.07],
        probability_positive: 0.65,
        propagation_delay_hours: 1,
        mechanism_coverage_complete: false,
      };
      const result = transformInterveneEffect(effect);
      expect(result.confidence_interval).toEqual([-0.01, 0.07]);
      expect(result.interval_method).toBe("bootstrap");
    });

    it("omits interval_method when no confidence_interval", () => {
      const effect: AbelInterveneEffect = {
        target: "SOL",
        expected_change: 0.02,
        unit: "log_return",
        probability_positive: 0.55,
        propagation_delay_hours: 3,
        mechanism_coverage_complete: true,
      };
      const result = transformInterveneEffect(effect);
      expect(result.interval_method).toBeUndefined();
    });

    it("adds edge_type directed_lagged to each causal_path edge", () => {
      const effect: AbelInterveneEffect = {
        target: "ETH",
        expected_change: 0.04,
        unit: "log_return",
        probability_positive: 0.68,
        propagation_delay_hours: 4,
        mechanism_coverage_complete: true,
        causal_path: [
          { from: "BTC", to: "ETH", weight: 0.6, tau: 2 },
          { from: "ETH", to: "SOL", weight: 0.3, tau: 1 },
        ],
      };
      const result = transformInterveneEffect(effect);
      expect(result.causal_path).toHaveLength(2);
      expect(result.causal_path![0]!.edge_type).toBe("directed_lagged");
      expect(result.causal_path![1]!.edge_type).toBe("directed_lagged");
    });

    it("omits causal_path when not provided", () => {
      const effect: AbelInterveneEffect = {
        target: "ETH",
        expected_change: 0.01,
        unit: "log_return",
        probability_positive: 0.6,
        propagation_delay_hours: 1,
        mechanism_coverage_complete: false,
      };
      const result = transformInterveneEffect(effect);
      expect(result.causal_path).toBeUndefined();
    });

    it("preserves all passthrough fields unchanged", () => {
      const effect: AbelInterveneEffect = {
        target: "LINK",
        expected_change: -0.02,
        unit: "percent",
        probability_positive: 0.4,
        propagation_delay_hours: 6,
        mechanism_coverage_complete: false,
      };
      const result = transformInterveneEffect(effect);
      expect(result.target).toBe("LINK");
      expect(result.expected_change).toBe(-0.02);
      expect(result.unit).toBe("percent");
      expect(result.probability_positive).toBe(0.4);
      expect(result.mechanism_coverage_complete).toBe(false);
    });

    it("handles zero propagation delay", () => {
      const effect: AbelInterveneEffect = {
        target: "ETH",
        expected_change: 0.0,
        unit: "log_return",
        probability_positive: 0.5,
        propagation_delay_hours: 0,
        mechanism_coverage_complete: true,
      };
      const result = transformInterveneEffect(effect);
      expect(result.propagation_delay).toBe("PT0H");
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
