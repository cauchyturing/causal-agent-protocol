import type { VerbHandler } from "../handler.js";
import {
  transformFeatureToCausal,
  computeImpactFractions,
} from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const observePredictMultiHandler: VerbHandler = {
  verb: "observe.predict_multistep",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const resp = await withErrorMapping(() => client.getMultiStepPrediction(target));
    const features = resp.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    return {
      result: {
        target,
        steps: resp.steps.map((s) => ({
          step: s.step,
          predicted_log_return: s.predicted_log_return,
          cumulative_log_return: s.cumulative_log_return,
          probability_positive: s.probability_positive,
          ...(s.confidence_interval && { confidence_interval: s.confidence_interval }),
        })),
        causal_features: features,
      },
    };
  },
};
