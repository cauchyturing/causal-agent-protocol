import type { VerbHandler } from "../handler.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const traverseLatestHandler: VerbHandler = {
  verb: "traverse.latest_values",
  handle: async (_params, client) => {
    const resp = await withErrorMapping(() => client.getLatestChange());
    return {
      result: {
        nodes: resp.nodes.map((n) => ({
          node_id: n.ticker,
          node_type: n.node_type,
          latest_value: n.latest_value,
          latest_change_percent: n.latest_change_percent,
          timestamp: n.timestamp,
        })),
      },
    };
  },
};
