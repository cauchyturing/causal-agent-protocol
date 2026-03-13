// src/verbs/core/effect-query.ts
import type { VerbHandler } from "../handler.js";
import { CAPError } from "../../cap/errors.js";
import {
  transformFeatureToCausal,
  computeImpactFractions,
  transformInterveneEffect,
} from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";
import {
  getEffectSemantics,
  ABEL_RESULT_SEMANTICS,
  assertResultSemanticsPresent,
} from "../_shared/l2-semantics.js";

export const effectQueryHandler: VerbHandler = {
  verb: "effect.query",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const queryType = params["query_type"] as string;

    if (queryType === "interventional") {
      const intervention = params["intervention"] as
        | { node_id: string; value: number; unit: string }
        | undefined;
      if (!intervention?.node_id) {
        throw new CAPError("invalid_intervention", {
          suggestion: "intervention.node_id is required for interventional queries",
        });
      }

      const startMs = Date.now();
      const interveneResult = await withErrorMapping(() =>
        client.intervene({
          interventions: [
            { ticker: intervention.node_id, value: intervention.value, unit: intervention.unit },
          ],
          targets: [target],
          horizon: params["horizon"] as string | undefined,
        })
      );

      const effect = interveneResult.effects[0];
      if (!effect) {
        throw new CAPError("node_not_found", {
          suggestion: `No effect computed for target '${target}'`,
        });
      }

      const transformed = transformInterveneEffect(effect);
      const semantics = getEffectSemantics(effect.mechanism_coverage_complete);

      const includePaths = params["include_paths"] === true;

      const result = {
        target,
        query_type: "interventional",
        estimate: {
          value: transformed.expected_change,
          unit: transformed.unit,
          direction:
            transformed.expected_change > 0.001
              ? "up"
              : transformed.expected_change < -0.001
                ? "down"
                : "neutral",
          probability_positive: transformed.probability_positive,
          ...(transformed.confidence_interval && {
            confidence_interval: transformed.confidence_interval,
            interval_method: transformed.interval_method,
          }),
          horizon: transformed.propagation_delay,
        },
        // L2 result-level semantics (§10.2 REQUIRED)
        reasoning_mode: semantics.reasoning_mode,
        identification_status: ABEL_RESULT_SEMANTICS.identification_status,
        assumptions: [...ABEL_RESULT_SEMANTICS.assumptions],
        // Optional: causal_path
        ...(includePaths && transformed.causal_path && { causal_path: transformed.causal_path }),
      };
      // Defense-in-depth: verify result-level L2 fields present
      assertResultSemanticsPresent(result as unknown as Record<string, unknown>);

      return {
        result,
        provenance: {
          graphVersion: "dynamic",
          graphTimestamp: new Date().toISOString(),
          computationTimeMs: Date.now() - startMs,
          mechanismFamilyUsed:
            semantics.reasoning_mode === "scm_simulation" ? "linear" : undefined,
        },
      };
    }

    // §6.4: include_provenance defaults to TRUE per spec (line 677)
    const includeProvenance = params["include_provenance"] !== false;

    const startMs = Date.now();
    const pred = await withErrorMapping(() => client.getPrediction(target));
    const features = pred.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    const topK = (params["top_k_causes"] as number) || 0;
    const displayFeatures = topK > 0 ? features.slice(0, topK) : features;

    return {
      result: {
        target,
        query_type: "observational",
        estimate: {
          value: pred.predicted_log_return,
          unit: "log_return",
          direction:
            pred.predicted_log_return > 0.001
              ? "up"
              : pred.predicted_log_return < -0.001
                ? "down"
                : "neutral",
          probability_positive: pred.probability_positive,
          ...(pred.confidence_interval && {
            confidence_interval: pred.confidence_interval,
            interval_method: "bootstrap",
          }),
          horizon: "PT1H",
        },
        causal_features: displayFeatures,
      },
      // §6.9: Provenance — return ProvenanceInput (buildProvenance converts at transport layer)
      ...(includeProvenance && {
        provenance: {
          graphVersion: "dynamic",
          graphTimestamp: new Date().toISOString(),
          computationTimeMs: Date.now() - startMs,
          mechanismFamilyUsed: "linear",
        },
      }),
    };
  },
};
