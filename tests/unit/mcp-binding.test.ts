import { describe, it, expect, vi } from "vitest";
import type { BoundDispatcher } from "../../src/transport/shared-types.js";
import {
  getToolDefinitions,
  TOOL_NAME_TO_VERB,
  createMcpServer,
} from "../../src/transport/mcp-binding.js";

// ── getToolDefinitions() ───────────────────────────────────────────────────

describe("getToolDefinitions()", () => {
  const tools = getToolDefinitions();

  it("returns exactly 20 tool definitions (all L1+L2 verbs)", () => {
    expect(tools).toHaveLength(20);
  });

  it("all tool names use cap_ prefix", () => {
    for (const tool of tools) {
      expect(tool.name).toMatch(/^cap_/);
    }
  });

  it("contains all expected tool names", () => {
    const names = tools.map((t) => t.name);
    const expected = [
      "cap_meta_capabilities",
      "cap_graph_neighbors",
      "cap_graph_paths",
      "cap_effect_query",
      "cap_observe_predict",
      "cap_observe_predict_multistep",
      "cap_observe_predict_batch",
      "cap_observe_attribute",
      "cap_traverse_parents",
      "cap_traverse_children",
      "cap_traverse_path",
      "cap_traverse_subgraph",
      "cap_traverse_latest_values",
      "cap_meta_graph_info",
      "cap_meta_node_info",
      "cap_meta_algorithms",
      "cap_meta_health",
      "cap_intervene_do",
      "cap_intervene_ate",
      "cap_intervene_sensitivity",
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });

  it("§8.2: every description includes the CAP verb name", () => {
    for (const tool of tools) {
      expect(tool.description).toContain(tool.verb);
    }
  });

  it("§8.2: every description includes [L1] or [L2] conformance level", () => {
    for (const tool of tools) {
      expect(tool.description).toMatch(/\[(L1|L2)\]/);
    }
  });

  it("§8.2: description conformance level matches the tool level field", () => {
    for (const tool of tools) {
      expect(tool.description).toContain(`[${tool.level}]`);
    }
  });

  it("cap_traverse_path has L2 level (§6.3 alias)", () => {
    const traversePath = tools.find((t) => t.name === "cap_traverse_path");
    expect(traversePath).toBeDefined();
    expect(traversePath?.level).toBe("L2");
  });

  it("cap_graph_paths has L2 level", () => {
    const graphPaths = tools.find((t) => t.name === "cap_graph_paths");
    expect(graphPaths).toBeDefined();
    expect(graphPaths?.level).toBe("L2");
  });

  it("all other tools have L1 level", () => {
    const l2tools = new Set([
      "cap_graph_paths", "cap_traverse_path",
      "cap_intervene_do", "cap_intervene_ate", "cap_intervene_sensitivity",
    ]);
    for (const tool of tools) {
      if (!l2tools.has(tool.name)) {
        expect(tool.level).toBe("L1");
      }
    }
  });
});

// ── TOOL_NAME_TO_VERB lookup table ─────────────────────────────────────────

describe("TOOL_NAME_TO_VERB", () => {
  it("correctly maps cap_observe_predict_multistep → observe.predict_multistep (NOT observe.predict.multistep)", () => {
    expect(TOOL_NAME_TO_VERB["cap_observe_predict_multistep"]).toBe(
      "observe.predict_multistep"
    );
  });

  it("correctly maps cap_observe_predict_batch → observe.predict_batch", () => {
    expect(TOOL_NAME_TO_VERB["cap_observe_predict_batch"]).toBe("observe.predict_batch");
  });

  it("correctly maps cap_traverse_latest_values → traverse.latest_values", () => {
    expect(TOOL_NAME_TO_VERB["cap_traverse_latest_values"]).toBe("traverse.latest_values");
  });

  it("correctly maps cap_meta_capabilities → meta.capabilities", () => {
    expect(TOOL_NAME_TO_VERB["cap_meta_capabilities"]).toBe("meta.capabilities");
  });

  it("correctly maps cap_traverse_path → traverse.path (§6.3 alias)", () => {
    expect(TOOL_NAME_TO_VERB["cap_traverse_path"]).toBe("traverse.path");
  });

  it("has an entry for all 20 tools", () => {
    const names = getToolDefinitions().map((t) => t.name);
    for (const name of names) {
      expect(TOOL_NAME_TO_VERB[name]).toBeDefined();
    }
  });
});

// ── createMcpServer() ──────────────────────────────────────────────────────

describe("createMcpServer()", () => {
  const mockDispatcher: BoundDispatcher = vi.fn().mockResolvedValue({
    result: { ok: true },
  });

  it("returns an McpServer instance", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const mcpServer = createMcpServer(mockDispatcher);
    expect(mcpServer).toBeInstanceOf(McpServer);
  });
});
