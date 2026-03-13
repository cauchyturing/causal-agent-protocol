// tests/conformance/level1.test.ts
//
// CAP v0.2.2 Level 1 Conformance Suite
// Tests protocol-level conformance using the dispatcher directly.
// Reference: /docs/CAP-v0.2.2-PROTOCOL-SPEC.md
import { describe, it, expect, vi } from "vitest";
import { createDispatcher } from "../../src/verbs/handler.js";
import { metaCapabilitiesHandler } from "../../src/verbs/core/meta-capabilities.js";
import { graphNeighborsHandler } from "../../src/verbs/core/graph-neighbors.js";
import { effectQueryHandler } from "../../src/verbs/core/effect-query.js";
import { getToolDefinitions } from "../../src/transport/mcp-binding.js";
import { CAPError } from "../../src/cap/errors.js";
import type { AbelClient } from "../../src/abel-client/client.js";
import type { Config } from "../../src/config.js";

// ── Mock Abel client for conformance tests ───────────────────────────────────

const mockClient = {
  getFeatures: vi.fn().mockResolvedValue({
    ticker: "BTC",
    features: [{ feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2 }],
  }),
  getChildren: vi.fn().mockResolvedValue({ ticker: "BTC", children: [] }),
  getPrediction: vi.fn().mockResolvedValue({
    ticker: "BTC",
    predicted_log_return: 0.023,
    probability_positive: 0.72,
    features: [
      { feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2, impact: 0.012 },
    ],
    intercept: 0.001,
  }),
  getHealth: vi.fn().mockResolvedValue({ status: "healthy" }),
} as unknown as AbelClient;

const mockConfig = { port: 3001 } as unknown as Config;

// ── Dispatcher wired with L1 core handlers ───────────────────────────────────

const dispatch = createDispatcher([
  metaCapabilitiesHandler,
  graphNeighborsHandler,
  effectQueryHandler,
]);

// ── §10.1 Core verb requirements ──────────────────────────────────────────────

describe("§10.1 Core verb requirements", () => {
  it("MUST implement meta.capabilities", async () => {
    const { result } = await dispatch("meta.capabilities", {}, mockClient, mockConfig);
    expect(result).toBeDefined();
    expect(result["name"]).toBeDefined();
  });

  it("MUST implement graph.neighbors — neighbors key exists", async () => {
    const { result } = await dispatch(
      "graph.neighbors",
      { node_id: "BTC", direction: "parents" },
      mockClient,
      mockConfig
    );
    expect(result["neighbors"]).toBeDefined();
    expect(Array.isArray(result["neighbors"])).toBe(true);
  });

  it("MUST implement graph.neighbors — undetermined_neighbor_count is 0", async () => {
    const { result } = await dispatch(
      "graph.neighbors",
      { node_id: "BTC", direction: "parents" },
      mockClient,
      mockConfig
    );
    expect(result["undetermined_neighbor_count"]).toBe(0);
  });

  it("MUST implement effect.query (observational) — estimate key exists", async () => {
    const { result } = await dispatch(
      "effect.query",
      { target: "BTC", query_type: "observational" },
      mockClient,
      mockConfig
    );
    expect(result["estimate"]).toBeDefined();
  });

  // §10.2: graph.paths is NOT required for L1 — it is an L2 verb.
  // This test documents that the dispatcher correctly rejects graph.paths at L1.
  it("graph.paths is NOT required for L1 (§10.2: L2 verb — dispatcher rejects unknown verb)", async () => {
    await expect(
      dispatch("graph.paths", { source: "BTC", target: "ETH" }, mockClient, mockConfig)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CAPError && err.code === "verb_not_supported"
    );
  });
});

// ── §4 Capability Card ────────────────────────────────────────────────────────

describe("§4 Capability Card", () => {
  let card: Record<string, unknown>;

  beforeEach(async () => {
    const { result } = await dispatch("meta.capabilities", {}, mockClient, mockConfig);
    card = result;
  });

  it("MUST include name", () => {
    expect(typeof card["name"]).toBe("string");
    expect((card["name"] as string).length).toBeGreaterThan(0);
  });

  it("MUST include description", () => {
    expect(typeof card["description"]).toBe("string");
    expect((card["description"] as string).length).toBeGreaterThan(0);
  });

  it("MUST include version", () => {
    expect(typeof card["version"]).toBe("string");
    expect((card["version"] as string).length).toBeGreaterThan(0);
  });

  it("MUST include cap_spec_version = '0.2.2'", () => {
    expect(card["cap_spec_version"]).toBe("0.2.2");
  });

  it("MUST include conformance_level >= 1", () => {
    const level = card["conformance_level"] as number;
    expect(typeof level).toBe("number");
    expect(level).toBeGreaterThanOrEqual(1);
  });

  it("MUST include supported_verbs", () => {
    const sv = card["supported_verbs"] as Record<string, unknown>;
    expect(sv).toBeDefined();
    expect(sv["core"]).toBeDefined();
    expect(Array.isArray(sv["core"])).toBe(true);
  });

  it("MUST include causal_engine", () => {
    expect(card["causal_engine"]).toBeDefined();
    const engine = card["causal_engine"] as Record<string, unknown>;
    expect(engine["family"]).toBeDefined();
    expect(engine["algorithm"]).toBeDefined();
  });

  it("MUST include detailed_capabilities", () => {
    expect(card["detailed_capabilities"]).toBeDefined();
  });

  it("MUST include assumptions", () => {
    expect(Array.isArray(card["assumptions"])).toBe(true);
    expect((card["assumptions"] as unknown[]).length).toBeGreaterThan(0);
  });

  it("MUST include reasoning_modes_supported", () => {
    expect(Array.isArray(card["reasoning_modes_supported"])).toBe(true);
    expect((card["reasoning_modes_supported"] as unknown[]).length).toBeGreaterThan(0);
  });

  it("MUST include graph", () => {
    const graph = card["graph"] as Record<string, unknown>;
    expect(graph).toBeDefined();
    expect(graph["node_count"]).toBeDefined();
    expect(graph["edge_count"]).toBeDefined();
  });

  it("MUST include authentication", () => {
    const auth = card["authentication"] as Record<string, unknown>;
    expect(auth).toBeDefined();
    expect(auth["type"]).toBeDefined();
  });
});

// ── §5.1 Claim-to-card binding ────────────────────────────────────────────────

describe("§5.1 claim-to-card binding", () => {
  it(
    "if reasoning_modes_supported includes 'scm_simulation', " +
      "causal_engine.structural_mechanisms MUST be present with available: true",
    async () => {
      const { result } = await dispatch("meta.capabilities", {}, mockClient, mockConfig);
      const modes = result["reasoning_modes_supported"] as string[];
      if (modes.includes("scm_simulation")) {
        const engine = result["causal_engine"] as Record<string, unknown>;
        const mechs = engine["structural_mechanisms"] as Record<string, unknown>;
        expect(mechs).toBeDefined();
        expect(mechs["available"]).toBe(true);
      }
    }
  );
});

// ── §6.4 effect.query L1 fallback ────────────────────────────────────────────

describe("§6.4 effect.query L1 fallback", () => {
  it("MUST reject interventional queries with query_type_not_supported", async () => {
    // CAPError sets .message to a human-readable string, NOT the error code.
    // Use .toSatisfy() to check .code directly.
    await expect(
      dispatch("effect.query", { target: "BTC", query_type: "interventional" }, mockClient, mockConfig)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CAPError && err.code === "query_type_not_supported"
    );
  });
});

// ── §6.7 Observational response fields at L1 ─────────────────────────────────

describe("§6.7 Observational response does NOT require reasoning_mode/identification_status at L1", () => {
  it("reasoning_mode is undefined in observational result", async () => {
    const { result } = await dispatch(
      "effect.query",
      { target: "BTC", query_type: "observational" },
      mockClient,
      mockConfig
    );
    expect(result["reasoning_mode"]).toBeUndefined();
  });

  it("identification_status is undefined in observational result", async () => {
    const { result } = await dispatch(
      "effect.query",
      { target: "BTC", query_type: "observational" },
      mockClient,
      mockConfig
    );
    expect(result["identification_status"]).toBeUndefined();
  });
});

// ── §8.2 MCP Binding ──────────────────────────────────────────────────────────

describe("§8.2 MCP Binding — tool description requirements", () => {
  it("ALL tool descriptions MUST include the CAP verb name", () => {
    const tools = getToolDefinitions();
    for (const tool of tools) {
      expect(tool.description).toContain(tool.verb);
    }
  });

  it("ALL tool descriptions MUST include conformance level tag [L1] or [L2]", () => {
    const tools = getToolDefinitions();
    for (const tool of tools) {
      const hasLevelTag = tool.description.includes("[L1]") || tool.description.includes("[L2]");
      expect(hasLevelTag, `Tool '${tool.name}' description missing [L1] or [L2] tag`).toBe(true);
    }
  });

  it("L1 tools are tagged [L1] and L2 tools are tagged [L2]", () => {
    const tools = getToolDefinitions();
    for (const tool of tools) {
      if (tool.level === "L1") {
        expect(tool.description, `Tool '${tool.name}' has level L1 but missing [L1] tag`).toContain(
          "[L1]"
        );
      } else {
        expect(tool.description, `Tool '${tool.name}' has level L2 but missing [L2] tag`).toContain(
          "[L2]"
        );
      }
    }
  });
});
