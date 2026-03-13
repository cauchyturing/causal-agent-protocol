import type { VerbHandler } from "../handler.js";
import {
  transformFeatureToNeighbor,
  transformChildToNeighbor,
} from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const graphNeighborsHandler: VerbHandler = {
  verb: "graph.neighbors",
  handle: async (params, client) => {
    const nodeId = params["node_id"] as string;
    const direction = params["direction"] as "parents" | "children" | "both";
    const topK = (params["top_k"] as number) || 0;
    const sortBy = (params["sort_by"] as string) || "weight";
    const includeValues = (params["include_values"] as boolean) || false;

    type Neighbor = ReturnType<typeof transformFeatureToNeighbor>;
    let neighbors: Neighbor[] = [];
    let intercept: number | undefined;

    if (direction === "parents" || direction === "both") {
      const featResp = await withErrorMapping(() => client.getFeatures(nodeId));
      neighbors.push(...featResp.features.map(transformFeatureToNeighbor));
      intercept = featResp.intercept;
    }

    if (direction === "children" || direction === "both") {
      const childResp = await withErrorMapping(() => client.getChildren(nodeId));
      neighbors.push(...childResp.children.map(transformChildToNeighbor));
    }

    // Sort
    if (sortBy === "weight") {
      neighbors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    } else if (sortBy === "tau") {
      neighbors.sort((a, b) => a.tau - b.tau);
    } else if (sortBy === "name") {
      neighbors.sort((a, b) => a.node_id.localeCompare(b.node_id));
    }

    // top_k
    if (topK > 0) {
      neighbors = neighbors.slice(0, topK);
    }

    // §6.5: include_values — strip current_value/current_change_percent if not requested
    type NeighborWithValues = Neighbor & {
      current_value?: number;
      current_change_percent?: number;
    };
    let outputNeighbors: unknown[];
    if (!includeValues) {
      outputNeighbors = (neighbors as NeighborWithValues[]).map(
        ({ current_value: _cv, current_change_percent: _ccp, ...rest }) => rest
      );
    } else {
      outputNeighbors = neighbors;
    }

    return {
      result: {
        node_id: nodeId,
        direction,
        neighbors: outputNeighbors,
        ...(intercept !== undefined && { intercept }),
        // §6.5: Abel uses DAG (not CPDAG/PAG), so all orientations are determined
        undetermined_neighbor_count: 0,
      },
    };
  },
};
