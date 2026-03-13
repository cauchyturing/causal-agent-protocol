/**
 * Abel's L2 Causal Semantics Declaration — v0.2.2
 *
 * This is the SINGLE SOURCE OF TRUTH for Abel's causal claims.
 * Every intervene.* effect passes through this.
 *
 * Abel's pipeline:
 * - PCMCI discovers time-lagged directed edges via conditional independence tests
 * - Linear / GBDT structural mechanisms fitted on discovered graph
 * - intervene.do: mechanism override (delete X's equation, fix X=x,
 *   keep other mechanisms, forward solve in temporal order)
 *
 * When all nodes in the solve path have mechanisms:
 *   reasoning_mode = "scm_simulation", mechanism_coverage_complete = true
 * When some path nodes lack mechanisms (fallback):
 *   reasoning_mode = "graph_propagation", mechanism_coverage_complete = false
 *
 * In BOTH cases: identification_status = "not_formally_identified"
 * Mechanism override ≠ formal identification.
 */

import type {
  CausalAssumption,
  PerEffectSemantics,
  ReasoningMode,
  ResultSemantics,
} from "../../cap/semantics.js";

export const ABEL_ASSUMPTIONS: readonly CausalAssumption[] = [
  "causal_sufficiency",
  "faithfulness",
  "stationarity",
  "no_instantaneous_effects",
  "mechanism_invariance_under_intervention",
] as const;

/**
 * Determine per-effect semantics based on mechanism coverage.
 * This is the Partial Coverage Rule (CAP v0.2.2 §6.6).
 */
export function getEffectSemantics(
  allPathNodesCovered: boolean
): PerEffectSemantics {
  if (allPathNodesCovered) {
    return {
      reasoning_mode: "scm_simulation",
      mechanism_coverage_complete: true,
    };
  }
  return {
    reasoning_mode: "graph_propagation",
    mechanism_coverage_complete: false,
  };
}

/** Result-level semantics (shared across all effects in a response) */
export const ABEL_RESULT_SEMANTICS: ResultSemantics = {
  identification_status: "not_formally_identified",
  assumptions: ABEL_ASSUMPTIONS,
} as const;

/**
 * Conformance guard: throws if an effect is missing required fields.
 * Call this in tests and optionally at runtime for defense-in-depth.
 */
export function assertEffectSemanticsPresent(
  effect: Record<string, unknown>
): void {
  if (!effect["reasoning_mode"]) {
    throw new Error(
      "CAP CONFORMANCE VIOLATION: intervene.do effect missing reasoning_mode. " +
        "Per CAP v0.2.2 §6.6, reasoning_mode is per-effect."
    );
  }
  if (effect["mechanism_coverage_complete"] === undefined) {
    throw new Error(
      "CAP CONFORMANCE VIOLATION: effect missing mechanism_coverage_complete."
    );
  }
}

/**
 * Conformance guard: throws if a result is missing required L2 fields.
 */
export function assertResultSemanticsPresent(
  result: Record<string, unknown>
): void {
  if (!result["identification_status"]) {
    throw new Error(
      "CAP CONFORMANCE VIOLATION: L2 result missing identification_status."
    );
  }
  if (!result["assumptions"] || !Array.isArray(result["assumptions"])) {
    throw new Error(
      "CAP CONFORMANCE VIOLATION: L2 result missing assumptions array."
    );
  }
}

/**
 * Validates that reasoning_mode claim is consistent with mechanism coverage.
 * scm_simulation requires mechanism_coverage_complete = true.
 */
export function validateReasoningModeClaim(
  reasoningMode: ReasoningMode,
  mechanismCoverageComplete: boolean
): void {
  if (reasoningMode === "scm_simulation" && !mechanismCoverageComplete) {
    throw new Error(
      "CAP CONFORMANCE VIOLATION: reasoning_mode is scm_simulation but " +
        "mechanism_coverage_complete is false. Per CAP v0.2.2 §6.6 Partial " +
        "Coverage Rule, scm_simulation requires full path coverage."
    );
  }
}
