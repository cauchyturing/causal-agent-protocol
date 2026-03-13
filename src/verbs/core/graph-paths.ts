import type { VerbHandler } from "../handler.js";
import { tauToISO } from "../../utils/duration.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

interface Edge {
  from: string;
  to: string;
  edge_type: string;
  tau: number;
  tau_duration: string;
  weight: number;
}

export const graphPathsHandler: VerbHandler = {
  verb: "graph.paths",
  handle: async (params, client) => {
    const source = params["source"] as string;
    const target = params["target"] as string;
    const maxDepth = (params["max_depth"] as number) || 5;

    const paths: Edge[][] = [];
    // Cache children responses to avoid redundant API calls
    const childrenCache = new Map<
      string,
      Awaited<ReturnType<typeof client.getChildren>>
    >();
    const queue: Array<{
      node: string;
      path: Edge[];
      depth: number;
      visitedInPath: Set<string>;
    }> = [{ node: source, path: [], depth: 0, visitedInPath: new Set([source]) }];

    while (queue.length > 0 && paths.length < 10) {
      const current = queue.shift()!;
      if (current.depth > maxDepth) continue;
      if (current.node === target && current.path.length > 0) {
        paths.push(current.path);
        continue; // found a path, don't explore further from target
      }

      // Use per-path visited set (not global) to allow multiple paths through shared nodes
      if (!childrenCache.has(current.node)) {
        childrenCache.set(
          current.node,
          await withErrorMapping(() => client.getChildren(current.node))
        );
      }
      const childResp = childrenCache.get(current.node)!;

      for (const child of childResp.children) {
        // Prevent cycles within a single path
        if (current.visitedInPath.has(child.child_name)) continue;

        const edge: Edge = {
          from: current.node,
          to: child.child_name,
          edge_type: "directed_lagged",
          tau: child.tau,
          tau_duration: tauToISO(child.tau),
          weight: child.weight,
        };
        const newVisited = new Set(current.visitedInPath);
        newVisited.add(child.child_name);
        queue.push({
          node: child.child_name,
          path: [...current.path, edge],
          depth: current.depth + 1,
          visitedInPath: newVisited,
        });
      }
    }

    return {
      result: {
        source,
        target,
        paths,
        path_count: paths.length,
      },
    };
  },
};
