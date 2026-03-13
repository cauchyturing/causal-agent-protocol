/**
 * MCP Binding — registers all 18 CAP verb handlers as MCP tools.
 *
 * §8.2 NORMATIVE: Every tool description includes CAP verb name AND conformance level.
 * §6.3: traverse.path alias for graph.paths is explicitly registered.
 *
 * IMPORTANT: Tool-name → verb mapping uses an explicit lookup table, NOT naive
 * replace(/_/g, "."), because `cap_observe_predict_multistep` would incorrectly
 * become `observe.predict.multistep` with a naive replacement.
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AbelClient } from "../abel-client/client.js";
import type { Config } from "../config.js";
import type { Dispatcher, VerbResult } from "../verbs/handler.js";
import { obfuscateResponse } from "../security/obfuscation.js";
import { getResponseDetail } from "../security/tiers.js";
import type { AccessTier } from "../security/tiers.js";

// ── §8.2 Tool definitions ──────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  verb: string;
  level: "L1" | "L2";
  description: string;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "cap_meta_capabilities",
    verb: "meta.capabilities",
    level: "L1",
    description:
      "[L1] CAP verb: meta.capabilities — Returns the Capability Card describing this CAP server's conformance level, supported verbs, and causal engine details.",
  },
  {
    name: "cap_graph_neighbors",
    verb: "graph.neighbors",
    level: "L1",
    description:
      "[L1] CAP verb: graph.neighbors — Returns the direct causal neighbors (parents, children, or both) of a node in the causal graph.",
  },
  {
    name: "cap_graph_paths",
    verb: "graph.paths",
    level: "L2",
    description:
      "[L2] CAP verb: graph.paths — Finds all directed causal paths between two nodes using BFS traversal up to a specified depth.",
  },
  {
    name: "cap_effect_query",
    verb: "effect.query",
    level: "L1",
    description:
      "[L1] CAP verb: effect.query — Queries the causal effect on a target node. Supports observational queries; interventional queries require L2.",
  },
  {
    name: "cap_observe_predict",
    verb: "observe.predict",
    level: "L1",
    description:
      "[L1] CAP verb: observe.predict — Generates a single-step causal prediction for a target node, with top causal features ranked by impact.",
  },
  {
    name: "cap_observe_predict_multistep",
    verb: "observe.predict_multistep",
    level: "L1",
    description:
      "[L1] CAP verb: observe.predict_multistep — Generates multi-step causal predictions for a target node over multiple time horizons.",
  },
  {
    name: "cap_observe_predict_batch",
    verb: "observe.predict_batch",
    level: "L1",
    description:
      "[L1] CAP verb: observe.predict_batch — Generates multi-step causal predictions for a batch of target nodes in a single call.",
  },
  {
    name: "cap_observe_attribute",
    verb: "observe.attribute",
    level: "L1",
    description:
      "[L1] CAP verb: observe.attribute — Attributes the predicted value of a target node to its direct causal features with impact fractions.",
  },
  {
    name: "cap_traverse_parents",
    verb: "traverse.parents",
    level: "L1",
    description:
      "[L1] CAP verb: traverse.parents — Returns the direct causal parents of a node, sorted by weight descending.",
  },
  {
    name: "cap_traverse_children",
    verb: "traverse.children",
    level: "L1",
    description:
      "[L1] CAP verb: traverse.children — Returns the direct causal children (downstream effects) of a node, sorted by weight descending.",
  },
  {
    name: "cap_traverse_path",
    verb: "traverse.path",
    level: "L2",
    description:
      "[L2] CAP verb: traverse.path — §6.3 alias for graph.paths. Finds directed causal paths between two nodes in the causal graph.",
  },
  {
    name: "cap_traverse_subgraph",
    verb: "traverse.subgraph",
    level: "L1",
    description:
      "[L1] CAP verb: traverse.subgraph — Returns the subgraph of nodes and edges within a given depth from a center node (max 50 edges).",
  },
  {
    name: "cap_traverse_latest_values",
    verb: "traverse.latest_values",
    level: "L1",
    description:
      "[L1] CAP verb: traverse.latest_values — Returns the latest causal change data across all ticker nodes in the graph.",
  },
  {
    name: "cap_meta_graph_info",
    verb: "meta.graph_info",
    level: "L1",
    description:
      "[L1] CAP verb: meta.graph_info — Returns metadata about the causal graph including version, node count, and discovery algorithm details.",
  },
  {
    name: "cap_meta_node_info",
    verb: "meta.node_info",
    level: "L1",
    description:
      "[L1] CAP verb: meta.node_info — Returns detailed information about a specific node including its parent and child counts.",
  },
  {
    name: "cap_meta_algorithms",
    verb: "meta.algorithms",
    level: "L1",
    description:
      "[L1] CAP verb: meta.algorithms — Lists the causal discovery and inference algorithms available in this CAP server.",
  },
  {
    name: "cap_meta_health",
    verb: "meta.health",
    level: "L1",
    description:
      "[L1] CAP verb: meta.health — Returns the health status of the Abel causal engine and its graph data freshness.",
  },
  {
    name: "cap_intervene_do",
    verb: "intervene.do",
    level: "L2",
    description:
      "[L2] CAP verb: intervene.do — Simulates Pearl's do-operator: fix nodes to specified values and observe causal effects on targets. Returns per-effect reasoning_mode and result-level identification_status.",
  },
];

// ── Explicit verb lookup table (§8.2 — no naive string manipulation) ───────
// Maps MCP tool name → CAP verb. Required because `cap_observe_predict_multistep`
// must map to `observe.predict_multistep`, NOT `observe.predict.multistep`.

export const TOOL_NAME_TO_VERB: Record<string, string> = Object.fromEntries(
  TOOL_DEFINITIONS.map((t) => [t.name, t.verb])
);

// ── Public API ──────────────────────────────────────────────────────────────

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

/**
 * Serialises a VerbResult to MCP CallToolResult format.
 * §8.2: When VerbResult has `.provenance`, include it in the JSON output.
 */
function toMcpResult(verbResult: VerbResult): {
  content: [{ type: "text"; text: string }];
} {
  const output: Record<string, unknown> = { ...verbResult.result };
  if (verbResult.provenance !== undefined) {
    output["_provenance"] = verbResult.provenance;
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
  };
}

/**
 * Creates an McpServer with all 18 CAP verb handlers registered as MCP tools.
 *
 * Tools that take no arguments (meta.capabilities, meta.algorithms,
 * meta.health, traverse.latest_values) are registered without an input schema.
 * All others receive a Zod raw-shape with their required/optional fields.
 */
export function createMcpServer(
  dispatcher: Dispatcher,
  client: AbelClient,
  config: Config
): McpServer {
  const server = new McpServer({
    name: "Abel CAP Server",
    version: "0.1.0",
  });

  const detail = getResponseDetail(config.accessTier as AccessTier);

  /** Apply obfuscation then convert to MCP result format. */
  function toMcpResultObfuscated(verbResult: VerbResult): {
    content: [{ type: "text"; text: string }];
  } {
    const obfuscatedResult = obfuscateResponse(verbResult.result, detail);
    return toMcpResult({ ...verbResult, result: obfuscatedResult });
  }

  // ── Zero-argument tools ────────────────────────────────────────────────

  const zeroArgTools: string[] = [
    "cap_meta_capabilities",
    "cap_meta_algorithms",
    "cap_meta_health",
    "cap_traverse_latest_values",
  ];

  for (const toolDef of TOOL_DEFINITIONS) {
    if (zeroArgTools.includes(toolDef.name)) {
      const verb = toolDef.verb;
      const description = toolDef.description;
      server.tool(toolDef.name, description, async () => {
        const result = await dispatcher(verb, {}, client, config);
        return toMcpResultObfuscated(result);
      });
    }
  }

  // ── Tools with input schemas ───────────────────────────────────────────

  // cap_meta_graph_info — zero params (server-level info, no node required)
  server.tool(
    "cap_meta_graph_info",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_meta_graph_info")!.description,
    async () => {
      const result = await dispatcher("meta.graph_info", {}, client, config);
      return toMcpResultObfuscated(result);
    }
  );

  // cap_graph_neighbors
  server.tool(
    "cap_graph_neighbors",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_graph_neighbors")!.description,
    {
      node_id: z.string().describe("The node (ticker symbol) to query neighbors for"),
      direction: z
        .enum(["parents", "children", "both"])
        .describe("Which neighbors to return"),
      top_k: z.number().int().optional().describe("Limit to top-K neighbors by weight"),
      sort_by: z
        .enum(["weight", "tau", "name"])
        .optional()
        .describe("Sort criterion (default: weight)"),
      include_values: z
        .boolean()
        .optional()
        .describe("Include current market values in response"),
    },
    async (args) => {
      const result = await dispatcher(
        "graph.neighbors",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_graph_paths
  server.tool(
    "cap_graph_paths",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_graph_paths")!.description,
    {
      source: z.string().describe("Starting node (ticker symbol)"),
      target: z.string().describe("Destination node (ticker symbol)"),
      max_depth: z
        .number()
        .int()
        .optional()
        .describe("Maximum path depth to search (default: 5)"),
    },
    async (args) => {
      const result = await dispatcher(
        "graph.paths",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_effect_query
  server.tool(
    "cap_effect_query",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_effect_query")!.description,
    {
      target: z.string().describe("Target node to query causal effect for"),
      query_type: z
        .enum(["observational", "interventional"])
        .describe("Type of causal query"),
      intervention: z
        .object({
          node_id: z.string(),
          value: z.number(),
          unit: z.string(),
        })
        .optional()
        .describe("Intervention specification (required for interventional queries)"),
      top_k_causes: z
        .number()
        .int()
        .optional()
        .describe("Number of top causal features to return (0 = all)"),
      include_provenance: z
        .boolean()
        .optional()
        .describe("Include provenance metadata in response (default: true)"),
      include_paths: z
        .boolean()
        .optional()
        .describe("Include causal paths in interventional response (default: false)"),
    },
    async (args) => {
      const result = await dispatcher(
        "effect.query",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_observe_predict
  server.tool(
    "cap_observe_predict",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_observe_predict")!.description,
    {
      target: z.string().describe("Target node (ticker symbol) to predict"),
      top_k_causes: z
        .number()
        .int()
        .optional()
        .describe("Number of top causal features to include (default: 3)"),
      feature_selection: z
        .enum(["impact", "weight", "tau"])
        .optional()
        .describe("Sort criterion for causal features (default: impact)"),
      include_provenance: z
        .boolean()
        .optional()
        .describe("Include provenance metadata in response"),
    },
    async (args) => {
      const result = await dispatcher(
        "observe.predict",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_observe_predict_multistep
  server.tool(
    "cap_observe_predict_multistep",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_observe_predict_multistep")!.description,
    {
      target: z.string().describe("Target node (ticker symbol) to predict"),
    },
    async (args) => {
      const result = await dispatcher(
        "observe.predict_multistep",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_observe_predict_batch
  server.tool(
    "cap_observe_predict_batch",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_observe_predict_batch")!.description,
    {
      targets: z
        .array(z.string())
        .describe("Array of target node (ticker symbol) identifiers to predict"),
    },
    async (args) => {
      const result = await dispatcher(
        "observe.predict_batch",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_observe_attribute
  server.tool(
    "cap_observe_attribute",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_observe_attribute")!.description,
    {
      target: z.string().describe("Target node (ticker symbol) to attribute"),
    },
    async (args) => {
      const result = await dispatcher(
        "observe.attribute",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_traverse_parents
  server.tool(
    "cap_traverse_parents",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_traverse_parents")!.description,
    {
      node_id: z.string().describe("Node (ticker symbol) to get parents for"),
      top_k: z
        .number()
        .int()
        .optional()
        .describe("Limit to top-K parents by weight"),
    },
    async (args) => {
      const result = await dispatcher(
        "traverse.parents",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_traverse_children
  server.tool(
    "cap_traverse_children",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_traverse_children")!.description,
    {
      node_id: z.string().describe("Node (ticker symbol) to get children for"),
      top_k: z
        .number()
        .int()
        .optional()
        .describe("Limit to top-K children by weight"),
    },
    async (args) => {
      const result = await dispatcher(
        "traverse.children",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_traverse_path (§6.3 alias for graph.paths)
  server.tool(
    "cap_traverse_path",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_traverse_path")!.description,
    {
      source: z.string().describe("Starting node (ticker symbol)"),
      target: z.string().describe("Destination node (ticker symbol)"),
      max_depth: z
        .number()
        .int()
        .optional()
        .describe("Maximum path depth to search (default: 5)"),
    },
    async (args) => {
      const result = await dispatcher(
        "traverse.path",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_traverse_subgraph
  server.tool(
    "cap_traverse_subgraph",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_traverse_subgraph")!.description,
    {
      node_id: z.string().describe("Center node (ticker symbol) of the subgraph"),
      depth: z
        .number()
        .int()
        .optional()
        .describe("Expansion depth (max 3, default: 1)"),
    },
    async (args) => {
      const result = await dispatcher(
        "traverse.subgraph",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_meta_node_info
  server.tool(
    "cap_meta_node_info",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_meta_node_info")!.description,
    {
      node_id: z.string().describe("Node (ticker symbol) to get info for"),
    },
    async (args) => {
      const result = await dispatcher(
        "meta.node_info",
        args as Record<string, unknown>,
        client,
        config
      );
      return toMcpResultObfuscated(result);
    }
  );

  // cap_intervene_do
  server.tool(
    "cap_intervene_do",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_intervene_do")!.description,
    {
      interventions: z.array(z.object({
        node_id: z.string(),
        value: z.number(),
        unit: z.string(),
      })),
      targets: z.array(z.string()),
      horizon: z.string().optional(),
      include_paths: z.boolean().optional(),
    },
    async ({ interventions, targets, horizon, include_paths }) => {
      const result = await dispatcher("intervene.do", { interventions, targets, horizon, include_paths }, client, config);
      return toMcpResultObfuscated(result);
    }
  );

  return server;
}
