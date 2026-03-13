/**
 * §6.6 intervene.do — Pearl's do-operator simulation.
 * Per-effect reasoning_mode + result-level identification_status.
 */

import type { VerbHandler } from "../handler.js";
import { CAPError } from "../../cap/errors.js";
import { transformInterveneEffect } from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";
import {
  getEffectSemantics,
  ABEL_RESULT_SEMANTICS,
  assertEffectSemanticsPresent,
  assertResultSemanticsPresent,
} from "../_shared/l2-semantics.js";

export const interveneDoHandler: VerbHandler = {
  verb: "intervene.do",
  handle: async (params, client) => {
    const interventions = params["interventions"] as Array<{
      node_id: string;
      value: number;
      unit: string;
    }>;
    const targets = params["targets"] as string[];
    const horizon = params["horizon"] as string | undefined;
    const includePaths = params["include_paths"] === true;

    if (!interventions?.length) {
      throw new CAPError("invalid_intervention", {
        suggestion: "At least one intervention is required",
      });
    }
    if (!targets?.length) {
      throw new CAPError("invalid_intervention", {
        suggestion: "At least one target is required",
      });
    }

    const startMs = Date.now();

    // Call Abel /intervene — map node_id → ticker for Abel API
    const abelResult = await withErrorMapping(() =>
      client.intervene({
        interventions: interventions.map((i) => ({
          ticker: i.node_id,
          value: i.value,
          unit: i.unit,
        })),
        targets,
        ...(horizon && { horizon }),
      })
    );

    // Transform each effect: shape conversion + per-effect semantics
    const effects = abelResult.effects.map((effect) => {
      const transformed = transformInterveneEffect(effect);
      const semantics = getEffectSemantics(effect.mechanism_coverage_complete);

      const withSemantics = {
        ...transformed,
        reasoning_mode: semantics.reasoning_mode,
        mechanism_coverage_complete: semantics.mechanism_coverage_complete,
      };

      // Strip causal_path if not requested
      if (!includePaths) {
        delete (withSemantics as Record<string, unknown>)["causal_path"];
      }
      // Defense-in-depth: verify per-effect L2 fields present
      assertEffectSemanticsPresent(withSemantics as Record<string, unknown>);
      return withSemantics;
    });

    const result = {
      interventions, // echo
      effects,
      // Result-level L2 semantics (§10.2 REQUIRED)
      identification_status: ABEL_RESULT_SEMANTICS.identification_status,
      assumptions: [...ABEL_RESULT_SEMANTICS.assumptions],
    };
    // Defense-in-depth: verify result-level L2 fields present
    assertResultSemanticsPresent(result as unknown as Record<string, unknown>);

    return {
      result,
      provenance: {
        graphVersion: "dynamic",
        graphTimestamp: new Date().toISOString(),
        computationTimeMs: Date.now() - startMs,
        mechanismFamilyUsed: "linear",
      },
    };
  },
};
