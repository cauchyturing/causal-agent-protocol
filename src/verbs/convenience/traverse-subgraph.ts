import type { VerbHandler } from "../handler.js";
import { tauToISO } from "../../utils/duration.js";

export const traverseSubgraphHandler: VerbHandler = {
  verb: "traverse.subgraph",
  handle: async (params, client, config) => {
    const nodeId = params["node_id"] as string;
    const depth = Math.min((params["depth"] as number) || 1, 3);
    const maxEdges = config.maxSubgraphEdges;

    const nodes = new Map<string, { node_id: string; node_type: string }>();
    const edges: Array<{
      from: string;
      to: string;
      edge_type: string;
      weight: number;
      tau: number;
      tau_duration: string;
    }> = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; d: number }> = [{ id: nodeId, d: 0 }];

    while (queue.length > 0 && edges.length < maxEdges) {
      const { id, d } = queue.shift()!;
      if (visited.has(id) || d > depth) continue;
      visited.add(id);

      const [featResp, childResp] = await Promise.all([
        client.getFeatures(id).catch(() => ({ ticker: id, features: [] })),
        client.getChildren(id).catch(() => ({ ticker: id, children: [] })),
      ]);

      nodes.set(id, { node_id: id, node_type: "unknown" });

      for (const f of featResp.features) {
        nodes.set(f.feature_name, { node_id: f.feature_name, node_type: f.feature_type });
        edges.push({
          from: f.feature_name,
          to: id,
          edge_type: "directed_lagged",
          weight: f.weight,
          tau: f.tau,
          tau_duration: tauToISO(f.tau),
        });
        if (d + 1 <= depth) queue.push({ id: f.feature_name, d: d + 1 });
        if (edges.length >= maxEdges) break;
      }

      for (const c of childResp.children) {
        nodes.set(c.child_name, { node_id: c.child_name, node_type: c.child_type });
        edges.push({
          from: id,
          to: c.child_name,
          edge_type: "directed_lagged",
          weight: c.weight,
          tau: c.tau,
          tau_duration: tauToISO(c.tau),
        });
        if (d + 1 <= depth) queue.push({ id: c.child_name, d: d + 1 });
        if (edges.length >= maxEdges) break;
      }
    }

    return {
      result: {
        center: nodeId,
        depth,
        nodes: Array.from(nodes.values()),
        edges,
        node_count: nodes.size,
        edge_count: edges.length,
        truncated: edges.length >= maxEdges,
      },
    };
  },
};
