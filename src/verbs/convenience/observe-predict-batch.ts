import type { VerbHandler } from "../handler.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const observePredictBatchHandler: VerbHandler = {
  verb: "observe.predict_batch",
  handle: async (params, client) => {
    const targets = params["targets"] as string[];
    const resp = await withErrorMapping(() => client.getBatchPrediction(targets));

    return {
      result: {
        predictions: resp.results.map((r) => ({
          target: r.ticker,
          steps: r.steps.map((s) => ({
            step: s.step,
            predicted_log_return: s.predicted_log_return,
            cumulative_log_return: s.cumulative_log_return,
            probability_positive: s.probability_positive,
          })),
        })),
      },
    };
  },
};
