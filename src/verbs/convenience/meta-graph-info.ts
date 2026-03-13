import type { VerbHandler } from "../handler.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const metaGraphInfoHandler: VerbHandler = {
  verb: "meta.graph_info",
  handle: async (_params, client) => {
    const health = await withErrorMapping(() => client.getHealth());
    return {
      result: {
        status: health.status,
        graph_version: health.graph_version,
        graph_timestamp: health.graph_timestamp,
        node_count: health.node_count,
        edge_count: health.edge_count,
        update_frequency: "PT4H",
        temporal_resolution: "PT1H",
        graph_representation: "time_lagged_dag",
      },
    };
  },
};
