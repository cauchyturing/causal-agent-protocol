/**
 * CAP Causal Semantics Types — v0.2.2 §5
 *
 * Engine-agnostic types for reasoning modes, identification status,
 * and assumptions. Any CAP implementation imports these.
 */

export const REASONING_MODES = [
  "identified_causal_effect",
  "scm_simulation",
  "graph_propagation",
  "reduced_form_estimate",
  "conditional_forecast",
  "heuristic",
] as const;

export type ReasoningMode = (typeof REASONING_MODES)[number];

export const IDENTIFICATION_STATUSES = [
  "identified",
  "partially_identified",
  "not_formally_identified",
  "not_applicable",
] as const;

export type IdentificationStatus = (typeof IDENTIFICATION_STATUSES)[number];

export const CANONICAL_ASSUMPTIONS = [
  "causal_sufficiency",
  "faithfulness",
  "acyclicity",
  "stationarity",
  "linearity",
  "no_instantaneous_effects",
  "granger_predictive_causality_only",
  "no_latent_confounders_addressed",
  "homogeneity",
  "positivity",
  "consistency",
  "no_interference",
  "mechanism_invariance_under_intervention",
] as const;

export type CausalAssumption = (typeof CANONICAL_ASSUMPTIONS)[number];

/** Per-effect semantics: attached to each effect in intervene.* responses */
export interface PerEffectSemantics {
  reasoning_mode: ReasoningMode;
  mechanism_coverage_complete: boolean;
}

/** Result-level semantics: attached to the result object of L2 responses */
export interface ResultSemantics {
  identification_status: IdentificationStatus;
  assumptions: readonly CausalAssumption[];
}
