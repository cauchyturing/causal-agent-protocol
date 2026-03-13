/**
 * MCP Binding — registers all L1+L2 CAP verb handlers as MCP tools.
 *
 * §8.2 NORMATIVE: Every tool description includes CAP verb name AND conformance level.
 * §6.3: traverse.path alias for graph.paths is explicitly registered.
 *
 * This binding is transport-agnostic. It accepts a BoundDispatcher that can be:
 * - A proxy to a CAP HTTP endpoint (bridge mode)
 * - A direct verb handler (embedded mode)
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { BoundDispatcher } from "./shared-types.js";

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
  {
    name: "cap_intervene_ate",
    verb: "intervene.ate",
    level: "L2",
    description:
      "[L2] CAP verb: intervene.ate — Estimates the Average Treatment Effect (ATE) of intervening on a treatment node, comparing treated vs control outcomes on a target.",
  },
  {
    name: "cap_intervene_sensitivity",
    verb: "intervene.sensitivity",
    level: "L2",
    description:
      "[L2] CAP verb: intervene.sensitivity — Performs sensitivity analysis on a causal effect estimate, testing robustness to assumption violations (e.g., unmeasured confounding).",
  },
];

// ── Explicit verb lookup table (§8.2 — no naive string manipulation) ───────

export const TOOL_NAME_TO_VERB: Record<string, string> = Object.fromEntries(
  TOOL_DEFINITIONS.map((t) => [t.name, t.verb])
);

// ── Public API ──────────────────────────────────────────────────────────────

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

/**
 * Serialises a verb result to MCP CallToolResult format.
 */
function toMcpResult(result: Record<string, unknown>): {
  content: [{ type: "text"; text: string }];
} {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

/**
 * Creates an McpServer with all L1+L2 CAP verb tools registered.
 *
 * The dispatcher handles all backend logic (verb execution, obfuscation, etc.).
 * This binding is a pure MCP-to-CAP translation layer.
 */
export function createMcpServer(dispatcher: BoundDispatcher): McpServer {
  const server = new McpServer({
    name: "Abel CAP Server",
    version: "0.1.0",
  });

  // ── Zero-argument tools ────────────────────────────────────────────────

  const zeroArgTools = new Set([
    "cap_meta_capabilities",
    "cap_meta_algorithms",
    "cap_meta_health",
    "cap_traverse_latest_values",
    "cap_meta_graph_info",
  ]);

  for (const toolDef of TOOL_DEFINITIONS) {
    if (zeroArgTools.has(toolDef.name)) {
      const verb = toolDef.verb;
      server.tool(toolDef.name, toolDef.description, async () => {
        const { result } = await dispatcher(verb, {});
        return toMcpResult(result);
      });
    }
  }

  // ── Tools with input schemas ───────────────────────────────────────────

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
      const { result } = await dispatcher("graph.neighbors", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_graph_paths
  server.tool(
    "cap_graph_paths",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_graph_paths")!.description,
    {
      source: z.string().describe("Starting node (ticker symbol)"),
      target: z.string().describe("Destination node (ticker symbol)"),
      max_depth: z.number().int().optional().describe("Maximum path depth to search (default: 5)"),
    },
    async (args) => {
      const { result } = await dispatcher("graph.paths", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_effect_query
  server.tool(
    "cap_effect_query",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_effect_query")!.description,
    {
      target: z.string().describe("Target node to query causal effect for"),
      query_type: z.enum(["observational", "interventional"]).describe("Type of causal query"),
      intervention: z
        .object({ node_id: z.string(), value: z.number(), unit: z.string() })
        .optional()
        .describe("Intervention specification (required for interventional queries)"),
      top_k_causes: z.number().int().optional().describe("Number of top causal features to return"),
      include_provenance: z.boolean().optional().describe("Include provenance metadata"),
      include_paths: z.boolean().optional().describe("Include causal paths in response"),
    },
    async (args) => {
      const { result } = await dispatcher("effect.query", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_observe_predict
  server.tool(
    "cap_observe_predict",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_observe_predict")!.description,
    {
      target: z.string().describe("Target node (ticker symbol) to predict"),
      top_k_causes: z.number().int().optional().describe("Number of top causal features (default: 3)"),
      feature_selection: z.enum(["impact", "weight", "tau"]).optional().describe("Sort criterion"),
      include_provenance: z.boolean().optional().describe("Include provenance metadata"),
    },
    async (args) => {
      const { result } = await dispatcher("observe.predict", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_observe_predict_multistep
  server.tool(
    "cap_observe_predict_multistep",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_observe_predict_multistep")!.description,
    { target: z.string().describe("Target node (ticker symbol) to predict") },
    async (args) => {
      const { result } = await dispatcher("observe.predict_multistep", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_observe_predict_batch
  server.tool(
    "cap_observe_predict_batch",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_observe_predict_batch")!.description,
    { targets: z.array(z.string()).describe("Array of target node identifiers to predict") },
    async (args) => {
      const { result } = await dispatcher("observe.predict_batch", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_observe_attribute
  server.tool(
    "cap_observe_attribute",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_observe_attribute")!.description,
    { target: z.string().describe("Target node (ticker symbol) to attribute") },
    async (args) => {
      const { result } = await dispatcher("observe.attribute", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_traverse_parents
  server.tool(
    "cap_traverse_parents",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_traverse_parents")!.description,
    {
      node_id: z.string().describe("Node (ticker symbol) to get parents for"),
      top_k: z.number().int().optional().describe("Limit to top-K parents by weight"),
    },
    async (args) => {
      const { result } = await dispatcher("traverse.parents", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_traverse_children
  server.tool(
    "cap_traverse_children",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_traverse_children")!.description,
    {
      node_id: z.string().describe("Node (ticker symbol) to get children for"),
      top_k: z.number().int().optional().describe("Limit to top-K children by weight"),
    },
    async (args) => {
      const { result } = await dispatcher("traverse.children", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_traverse_path (§6.3 alias)
  server.tool(
    "cap_traverse_path",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_traverse_path")!.description,
    {
      source: z.string().describe("Starting node (ticker symbol)"),
      target: z.string().describe("Destination node (ticker symbol)"),
      max_depth: z.number().int().optional().describe("Maximum path depth (default: 5)"),
    },
    async (args) => {
      const { result } = await dispatcher("traverse.path", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_traverse_subgraph
  server.tool(
    "cap_traverse_subgraph",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_traverse_subgraph")!.description,
    {
      node_id: z.string().describe("Center node (ticker symbol) of the subgraph"),
      depth: z.number().int().optional().describe("Expansion depth (max 3, default: 1)"),
    },
    async (args) => {
      const { result } = await dispatcher("traverse.subgraph", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_meta_node_info
  server.tool(
    "cap_meta_node_info",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_meta_node_info")!.description,
    { node_id: z.string().describe("Node (ticker symbol) to get info for") },
    async (args) => {
      const { result } = await dispatcher("meta.node_info", args as Record<string, unknown>);
      return toMcpResult(result);
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
      const { result } = await dispatcher("intervene.do", { interventions, targets, horizon, include_paths });
      return toMcpResult(result);
    }
  );

  // cap_intervene_ate
  server.tool(
    "cap_intervene_ate",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_intervene_ate")!.description,
    {
      treatment: z.string().describe("Treatment node (ticker symbol)"),
      target: z.string().describe("Outcome node (ticker symbol)"),
      treatment_value: z.number().describe("Intervention value for treatment node"),
      control_value: z.number().describe("Control (baseline) value for treatment node"),
      unit: z.string().describe("Unit of the treatment values"),
      horizon: z.string().optional().describe("Prediction horizon (ISO 8601 duration)"),
    },
    async (args) => {
      const { result } = await dispatcher("intervene.ate", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  // cap_intervene_sensitivity
  server.tool(
    "cap_intervene_sensitivity",
    TOOL_DEFINITIONS.find((t) => t.name === "cap_intervene_sensitivity")!.description,
    {
      treatment: z.string().describe("Treatment node (ticker symbol)"),
      target: z.string().describe("Outcome node (ticker symbol)"),
      method: z.enum(["rosenbaum_bounds", "e_value", "omitted_variable_bias"]).optional()
        .describe("Sensitivity analysis method (default: e_value)"),
    },
    async (args) => {
      const { result } = await dispatcher("intervene.sensitivity", args as Record<string, unknown>);
      return toMcpResult(result);
    }
  );

  return server;
}
