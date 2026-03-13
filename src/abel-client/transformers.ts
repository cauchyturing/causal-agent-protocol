/**
 * Abel API → CAP format transformers.
 *
 * Converts raw Abel responses into CAP standard objects.
 * This is the translation layer — Abel shapes go in, CAP shapes come out.
 */

import type { CausalFeature } from "../utils/schemas.js";
import { tauToISO } from "../utils/duration.js";
import type { AbelFeature, AbelChild } from "./types.js";

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
  const totalImpact = features.reduce(
    (sum, f) => sum + Math.abs(f.impact),
    0
  );
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
