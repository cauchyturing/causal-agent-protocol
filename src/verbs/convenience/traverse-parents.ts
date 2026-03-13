import type { VerbHandler } from "../handler.js";
import { transformFeatureToNeighbor } from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const traverseParentsHandler: VerbHandler = {
  verb: "traverse.parents",
  handle: async (params, client) => {
    const nodeId = params["node_id"] as string;
    const topK = (params["top_k"] as number) || 0;
    const resp = await withErrorMapping(() => client.getFeatures(nodeId));
    let neighbors = resp.features.map(transformFeatureToNeighbor);
    neighbors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    if (topK > 0) neighbors = neighbors.slice(0, topK);
    return {
      result: {
        node_id: nodeId,
        direction: "parents",
        neighbors,
        ...(resp.intercept !== undefined && { intercept: resp.intercept }),
      },
    };
  },
};
