/**
 * Abel API → CAP format transformers.
 *
 * Converts raw Abel responses into CAP standard objects.
 * This is the translation layer — Abel shapes go in, CAP shapes come out.
 */

import type { CausalFeature } from "../utils/schemas.js";
import { tauToISO, hoursToISO } from "../utils/duration.js";
import type { AbelFeature, AbelChild, AbelInterveneEffect } from "./types.js";

/** Transform Abel feature → CAP CausalFeature */
export function transformFeatureToCausal(f: AbelFeature): CausalFeature {
  return {
    node_id: f.feature_name,
    node_name: f.feature_name,
    node_type: f.feature_type,
    edge_type: "directed_lagged",
    impact: f.impact ?? f.weight * (f.current_change_percent ?? 0),
    impact_fraction: 0, // computed by caller with full context
    weight: f.weight,
    tau: f.tau,
    tau_duration: tauToISO(f.tau),
    ...(f.current_value !== undefined && { current_value: f.current_value }),
    ...(f.current_change_percent !== undefined && {
      current_change_percent: f.current_change_percent,
    }),
  };
}

/** Transform Abel child → CAP neighbor format */
export function transformChildToNeighbor(c: AbelChild) {
  return {
    node_id: c.child_name,
    node_name: c.child_name,
    node_type: c.child_type,
    domain: inferDomain(c.child_type),
    edge_type: "directed_lagged",
    weight: c.weight,
    tau: c.tau,
    tau_duration: tauToISO(c.tau),
    ...(c.current_value !== undefined && { current_value: c.current_value }),
    ...(c.current_change_percent !== undefined && {
      current_change_percent: c.current_change_percent,
    }),
  };
}

/** Transform Abel feature → CAP neighbor format (parent direction) */
export function transformFeatureToNeighbor(f: AbelFeature) {
  return {
    node_id: f.feature_name,
    node_name: f.feature_name,
    node_type: f.feature_type,
    domain: inferDomain(f.feature_type),
    edge_type: "directed_lagged",
    weight: f.weight,
    tau: f.tau,
    tau_duration: tauToISO(f.tau),
    ...(f.current_value !== undefined && { current_value: f.current_value }),
    ...(f.current_change_percent !== undefined && {
      current_change_percent: f.current_change_percent,
    }),
  };
}

/** Compute impact fractions for a list of causal features */
export function computeImpactFractions(features: CausalFeature[]): void {
  const totalImpact = features.reduce((sum, f) => sum + Math.abs(f.impact), 0);
  if (totalImpact === 0) return;
  for (const f of features) {
    f.impact_fraction = Math.abs(f.impact) / totalImpact;
  }
}

function inferDomain(nodeType: string): string {
  const typeMap: Record<string, string> = {
    asset_price: "crypto",
    macro_indicator: "macro-economics",
    on_chain_metric: "crypto",
    volatility_index: "finance",
  };
  return typeMap[nodeType] ?? "finance";
}

/** CAP §6.6 effect shape (shape-only, no semantic injection — that's the handler's job) */
export interface TransformedInterveneEffect {
  target: string;
  expected_change: number;
  unit: string;
  confidence_interval?: [number, number];
  interval_method?: string;
  probability_positive: number;
  propagation_delay: string;
  mechanism_coverage_complete: boolean;
  causal_path?: Array<{
    from: string;
    to: string;
    edge_type: string;
    weight: number;
    tau: number;
  }>;
}

/**
 * Transform AbelInterveneEffect → CAP §6.6 effect shape.
 *
 * Shape conversions performed here (layer: abel-client → pure transform, no semantics):
 *   - propagation_delay_hours (number) → propagation_delay (ISO 8601, e.g. "PT2H")
 *   - causal_path edges: inject edge_type: "directed_lagged"
 *   - confidence_interval present → add interval_method: "bootstrap"
 *
 * NOT done here (handler's responsibility):
 *   - reasoning_mode injection (requires getEffectSemantics from verbs/_shared — layer violation)
 */
export function transformInterveneEffect(
  effect: AbelInterveneEffect
): TransformedInterveneEffect {
  return {
    target: effect.target,
    expected_change: effect.expected_change,
    unit: effect.unit,
    ...(effect.confidence_interval !== undefined && {
      confidence_interval: effect.confidence_interval,
      interval_method: "bootstrap",
    }),
    probability_positive: effect.probability_positive,
    propagation_delay: hoursToISO(effect.propagation_delay_hours),
    mechanism_coverage_complete: effect.mechanism_coverage_complete,
    ...(effect.causal_path !== undefined && {
      causal_path: effect.causal_path.map((edge) => ({
        from: edge.from,
        to: edge.to,
        edge_type: "directed_lagged",
        weight: edge.weight,
        tau: edge.tau,
      })),
    }),
  };
}
