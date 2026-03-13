import type { VerbHandler } from "../handler.js";
import {
  transformFeatureToCausal,
  computeImpactFractions,
} from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const observeAttributeHandler: VerbHandler = {
  verb: "observe.attribute",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const pred = await withErrorMapping(() => client.getPrediction(target));
    const features = pred.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    return {
      result: {
        target,
        predicted_value: pred.predicted_log_return,
        unit: "log_return",
        causal_features: features,
        intercept: pred.intercept,
      },
    };
  },
};
