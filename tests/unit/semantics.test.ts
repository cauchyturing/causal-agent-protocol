import { describe, it, expect } from "vitest";
import {
  getEffectSemantics,
  ABEL_RESULT_SEMANTICS,
  assertEffectSemanticsPresent,
  assertResultSemanticsPresent,
  validateReasoningModeClaim,
  ABEL_ASSUMPTIONS,
} from "../../src/verbs/_shared/l2-semantics.js";

describe("l2-semantics", () => {
  describe("getEffectSemantics", () => {
    it("returns scm_simulation when all path nodes covered", () => {
      const result = getEffectSemantics(true);
      expect(result.reasoning_mode).toBe("scm_simulation");
      expect(result.mechanism_coverage_complete).toBe(true);
    });

    it("returns graph_propagation when coverage is partial", () => {
      const result = getEffectSemantics(false);
      expect(result.reasoning_mode).toBe("graph_propagation");
      expect(result.mechanism_coverage_complete).toBe(false);
    });
  });

  describe("ABEL_RESULT_SEMANTICS", () => {
    it("always declares not_formally_identified", () => {
      expect(ABEL_RESULT_SEMANTICS.identification_status).toBe("not_formally_identified");
    });

    it("includes all required assumptions", () => {
      expect(ABEL_RESULT_SEMANTICS.assumptions).toEqual(ABEL_ASSUMPTIONS);
      expect(ABEL_RESULT_SEMANTICS.assumptions).toContain("causal_sufficiency");
      expect(ABEL_RESULT_SEMANTICS.assumptions).toContain(
        "mechanism_invariance_under_intervention"
      );
    });
  });

  describe("assertEffectSemanticsPresent", () => {
    it("passes for valid effect", () => {
      expect(() =>
        assertEffectSemanticsPresent({
          reasoning_mode: "scm_simulation",
          mechanism_coverage_complete: true,
        })
      ).not.toThrow();
    });

    it("throws when reasoning_mode missing", () => {
      expect(() =>
        assertEffectSemanticsPresent({ mechanism_coverage_complete: true })
      ).toThrow("reasoning_mode");
    });

    it("throws when mechanism_coverage_complete missing", () => {
      expect(() =>
        assertEffectSemanticsPresent({ reasoning_mode: "scm_simulation" })
      ).toThrow("mechanism_coverage_complete");
    });
  });

  describe("assertResultSemanticsPresent", () => {
    it("passes for valid result", () => {
      expect(() =>
        assertResultSemanticsPresent({
          identification_status: "not_formally_identified",
          assumptions: ["causal_sufficiency"],
        })
      ).not.toThrow();
    });

    it("throws when identification_status missing", () => {
      expect(() => assertResultSemanticsPresent({ assumptions: [] })).toThrow(
        "identification_status"
      );
    });

    it("throws when assumptions missing", () => {
      expect(() =>
        assertResultSemanticsPresent({
          identification_status: "not_formally_identified",
        })
      ).toThrow("assumptions");
    });
  });

  describe("validateReasoningModeClaim", () => {
    it("passes: scm_simulation with full coverage", () => {
      expect(() => validateReasoningModeClaim("scm_simulation", true)).not.toThrow();
    });

    it("passes: graph_propagation with partial coverage", () => {
      expect(() => validateReasoningModeClaim("graph_propagation", false)).not.toThrow();
    });

    it("passes: graph_propagation with full coverage (conservative ok)", () => {
      expect(() => validateReasoningModeClaim("graph_propagation", true)).not.toThrow();
    });

    it("FAILS: scm_simulation without full coverage (Partial Coverage Rule)", () => {
      expect(() => validateReasoningModeClaim("scm_simulation", false)).toThrow(
        "Partial Coverage Rule"
      );
    });
  });
});
