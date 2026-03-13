// src/verbs/core/effect-query.ts
import type { VerbHandler } from "../handler.js";
import { CAPError } from "../../cap/errors.js";
import {
  transformFeatureToCausal,
  computeImpactFractions,
} from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const effectQueryHandler: VerbHandler = {
  verb: "effect.query",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const queryType = params["query_type"] as string;

    if (queryType === "interventional") {
      throw new CAPError("query_type_not_supported", {
        suggestion:
          "Interventional queries via effect.query will be available in a future release. Use intervene.do for intervention simulation.",
      });
    }

    const pred = await withErrorMapping(() => client.getPrediction(target));
    const features = pred.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    const topK = (params["top_k_causes"] as number) || 0;
    const displayFeatures = topK > 0 ? features.slice(0, topK) : features;
    // §6.4: include_provenance defaults to TRUE per spec (line 677)
    const includeProvenance = params["include_provenance"] !== false;

    const startMs = Date.now();

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
