import type { VerbHandler } from "../handler.js";
import {
  transformFeatureToCausal,
  computeImpactFractions,
} from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const observePredictHandler: VerbHandler = {
  verb: "observe.predict",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const topK = (params["top_k_causes"] as number) || 3;
    const featureSelection = (params["feature_selection"] as string) || "impact";
    // §6.7: include_provenance defaults to TRUE per spec
    const includeProvenance = params["include_provenance"] !== false;

    const startMs = Date.now();
    const pred = await withErrorMapping(() => client.getPrediction(target));
    const features = pred.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    // §6.7: Sort causal features by selected criterion
    if (featureSelection === "weight") {
      features.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    } else if (featureSelection === "tau") {
      features.sort((a, b) => a.tau - b.tau);
    }
    // Default "impact" — already sorted by |impact| from computeImpactFractions

    return {
      result: {
        target,
        prediction: {
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
        causal_features: topK > 0 ? features.slice(0, topK) : features,
        target_context: {
          latest_value: pred.latest_value,
          latest_change_percent: pred.latest_change_percent,
          timestamp: pred.timestamp,
        },
      },
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
