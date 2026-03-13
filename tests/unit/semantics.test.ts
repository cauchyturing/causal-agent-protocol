// tests/unit/semantics.test.ts
//
// Verifies that causal semantics constants match CAP v0.2.2 spec §5 + Appendix C.

import { describe, it, expect } from "vitest";
import {
  REASONING_MODES,
  IDENTIFICATION_STATUSES,
  CANONICAL_ASSUMPTIONS,
} from "../../src/cap/semantics.js";

describe("REASONING_MODES (Appendix C.1)", () => {
  const specValues = [
    "identified_causal_effect",
    "scm_simulation",
    "graph_propagation",
    "reduced_form_estimate",
    "conditional_forecast",
    "heuristic",
  ];

  it("contains all 6 spec-defined reasoning modes", () => {
    for (const mode of specValues) {
      expect(REASONING_MODES).toContain(mode);
    }
  });

  it("has exactly 6 entries (no extras)", () => {
    expect(REASONING_MODES).toHaveLength(6);
  });
});

describe("IDENTIFICATION_STATUSES (Appendix C.2)", () => {
  const specValues = [
    "identified",
    "partially_identified",
    "not_formally_identified",
    "not_applicable",
  ];

  it("contains all 4 spec-defined identification statuses", () => {
    for (const status of specValues) {
      expect(IDENTIFICATION_STATUSES).toContain(status);
    }
  });

  it("has exactly 4 entries (no extras)", () => {
    expect(IDENTIFICATION_STATUSES).toHaveLength(4);
  });
});

describe("CANONICAL_ASSUMPTIONS (Appendix C.3)", () => {
  const specValues = [
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
  ];

  it("contains all 13 spec-defined canonical assumptions", () => {
    for (const assumption of specValues) {
      expect(CANONICAL_ASSUMPTIONS).toContain(assumption);
    }
  });

  it("has exactly 13 entries (no extras)", () => {
    expect(CANONICAL_ASSUMPTIONS).toHaveLength(13);
  });
});
