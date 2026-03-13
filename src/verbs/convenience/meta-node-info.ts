import type { VerbHandler } from "../handler.js";
import {
  transformFeatureToNeighbor,
  transformChildToNeighbor,
} from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const metaNodeInfoHandler: VerbHandler = {
  verb: "meta.node_info",
  handle: async (params, client) => {
    const nodeId = params["node_id"] as string;
    const [featResp, childResp] = await Promise.all([
      withErrorMapping(() => client.getFeatures(nodeId)),
      withErrorMapping(() => client.getChildren(nodeId)),
    ]);
    return {
      result: {
        node_id: nodeId,
        parent_count: featResp.features.length,
        child_count: childResp.children.length,
        parents: featResp.features.map(transformFeatureToNeighbor),
        children: childResp.children.map(transformChildToNeighbor),
      },
    };
  },
};
