import type { VerbHandler } from "../handler.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const metaHealthHandler: VerbHandler = {
  verb: "meta.health",
  handle: async (_params, client) => {
    const health = await withErrorMapping(() => client.getHealth());
    return {
      result: {
        status: health.status,
        version: health.version,
        graph_version: health.graph_version,
        graph_timestamp: health.graph_timestamp,
      },
    };
  },
};
