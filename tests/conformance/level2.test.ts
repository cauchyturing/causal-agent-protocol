// tests/conformance/level2.test.ts
//
// CAP v0.2.2 Level 2 Conformance Suite
// Reference: /docs/CAP-v0.2.2-PROTOCOL-SPEC.md

import { describe, it, expect, vi } from "vitest";
import { createDispatcher } from "../../src/verbs/handler.js";
import { effectQueryHandler } from "../../src/verbs/core/effect-query.js";
import { interveneDoHandler } from "../../src/verbs/convenience/intervene-do.js";
import { metaCapabilitiesHandler } from "../../src/verbs/core/meta-capabilities.js";
import { graphPathsHandler } from "../../src/verbs/core/graph-paths.js";
import { graphNeighborsHandler } from "../../src/verbs/core/graph-neighbors.js";
import type { AbelClient } from "../../src/abel-client/client.js";
import type { Config } from "../../src/config.js";

// ── Mock Abel client for L2 conformance tests ────────────────────────────────

const mockInterveneClient = {
  intervene: vi.fn().mockResolvedValue({
    interventions: [{ ticker: "BTC", value: 0.05, unit: "log_return" }],
    effects: [
      {
        target: "ETH",
        expected_change: 0.02,
        unit: "log_return",
        probability_positive: 0.75,
        propagation_delay_hours: 2,
        mechanism_coverage_complete: true,
        causal_path: [{ from: "BTC", to: "ETH", weight: 0.35, tau: 2 }],
      },
    ],
  }),
  getFeatures: vi.fn().mockResolvedValue({
    ticker: "BTC",
    features: [
      { feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2 },
    ],
  }),
  getChildren: vi.fn().mockResolvedValue({
    ticker: "BTC",
    children: [
      { child_name: "ETH", child_type: "asset_price", weight: 0.35, tau: 2 },
    ],
  }),
  getPrediction: vi.fn().mockResolvedValue({
    ticker: "BTC",
    predicted_log_return: 0.023,
    probability_positive: 0.72,
    features: [
      {
        feature_name: "ETH",
        feature_type: "asset_price",
        weight: 0.35,
        tau: 2,
        impact: 0.012,
      },
    ],
    intercept: 0.001,
  }),
  getHealth: vi.fn().mockResolvedValue({ status: "healthy" }),
} as unknown as AbelClient;

// Mixed coverage mock: ETH = full coverage, SOL = partial coverage
const mockMixedCoverageClient = {
  ...mockInterveneClient,
  intervene: vi.fn().mockResolvedValue({
    interventions: [{ ticker: "BTC", value: 0.05, unit: "log_return" }],
    effects: [
      {
        target: "ETH",
        expected_change: 0.02,
        unit: "log_return",
        probability_positive: 0.75,
        propagation_delay_hours: 2,
        mechanism_coverage_complete: true, // full coverage
      },
      {
        target: "SOL",
        expected_change: 0.01,
        unit: "log_return",
        probability_positive: 0.6,
        propagation_delay_hours: 4,
        mechanism_coverage_complete: false, // partial coverage
      },
    ],
  }),
} as unknown as AbelClient;

const mockConfig = { port: 3001 } as unknown as Config;

// ── Dispatcher wired with L2 handlers ─────────────────────────────────────────

const dispatch = createDispatcher([
  metaCapabilitiesHandler,
  graphNeighborsHandler,
  graphPathsHandler,
  effectQueryHandler,
  interveneDoHandler,
]);

// ── §10.2 Core Level 2 requirements ──────────────────────────────────────────

describe("§10.2 Level 2 core verb requirements", () => {
  it("MUST implement effect.query with interventional query_type", async () => {
    const { result } = await dispatch(
      "effect.query",
      {
        target: "ETH",
        query_type: "interventional",
        intervention: { node_id: "BTC", value: 0.05, unit: "log_return" },
      },
      mockInterveneClient,
      mockConfig,
    );
    expect(result["query_type"]).toBe("interventional");
    expect(result["estimate"]).toBeDefined();
  });

  it("MUST implement graph.paths (L2 core verb)", async () => {
    const { result } = await dispatch(
      "graph.paths",
      { source: "BTC", target: "ETH", max_depth: 2 },
      mockInterveneClient,
      mockConfig,
    );
    expect(result["paths"]).toBeDefined();
  });

  it("SHOULD implement intervene.do (L2 convenience)", async () => {
    const { result } = await dispatch(
      "intervene.do",
      {
        interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }],
        targets: ["ETH"],
      },
      mockInterveneClient,
      mockConfig,
    );
    expect(result["effects"]).toBeDefined();
  });
});

// ── §5.1 Claim-to-card binding ───────────────────────────────────────────────

describe("§5.1 Claim-to-card binding", () => {
  it("Capability Card declaring scm_simulation MUST include structural_mechanisms with available=true and mechanism_override_supported=true", async () => {
    const { result } = await dispatch(
      "meta.capabilities",
      {},
      mockInterveneClient,
      mockConfig,
    );
    const modes = result["reasoning_modes_supported"] as string[];
    if (modes.includes("scm_simulation")) {
      const engine = result["causal_engine"] as Record<string, unknown>;
      const mechs = engine["structural_mechanisms"] as Record<string, unknown>;
      expect(mechs).toBeDefined();
      expect(mechs["available"]).toBe(true);
      expect(mechs["mechanism_override_supported"]).toBe(true);
    }
  });
});

// ── §10.2 L2 mandatory response fields — effect.query(interventional) ────────

describe("§10.2 L2 mandatory response fields — effect.query(interventional)", () => {
  it("MUST include reasoning_mode in interventional response", async () => {
    const { result } = await dispatch(
      "effect.query",
      {
        target: "ETH",
        query_type: "interventional",
        intervention: { node_id: "BTC", value: 0.05, unit: "log_return" },
      },
      mockInterveneClient,
      mockConfig,
    );
    expect(result["reasoning_mode"]).toBeDefined();
    expect(["scm_simulation", "graph_propagation"]).toContain(result["reasoning_mode"]);
  });

  it("MUST include identification_status in interventional response", async () => {
    const { result } = await dispatch(
      "effect.query",
      {
        target: "ETH",
        query_type: "interventional",
        intervention: { node_id: "BTC", value: 0.05, unit: "log_return" },
      },
      mockInterveneClient,
      mockConfig,
    );
    expect(result["identification_status"]).toBeDefined();
  });

  it("MUST include assumptions array in interventional response", async () => {
    const { result } = await dispatch(
      "effect.query",
      {
        target: "ETH",
        query_type: "interventional",
        intervention: { node_id: "BTC", value: 0.05, unit: "log_return" },
      },
      mockInterveneClient,
      mockConfig,
    );
    expect(Array.isArray(result["assumptions"])).toBe(true);
    expect((result["assumptions"] as unknown[]).length).toBeGreaterThan(0);
  });
});

// ── §6.6 Partial Coverage Rule — intervene.do ────────────────────────────────

describe("§6.6 Partial Coverage Rule — intervene.do", () => {
  it("full coverage effect MUST have reasoning_mode = scm_simulation", async () => {
    const { result } = await dispatch(
      "intervene.do",
      {
        interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }],
        targets: ["ETH"],
      },
      mockInterveneClient,
      mockConfig,
    );
    const effects = result["effects"] as Array<Record<string, unknown>>;
    expect(effects[0]["reasoning_mode"]).toBe("scm_simulation");
    expect(effects[0]["mechanism_coverage_complete"]).toBe(true);
  });

  it("partial coverage effect MUST NOT have reasoning_mode = scm_simulation", async () => {
    const { result } = await dispatch(
      "intervene.do",
      {
        interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }],
        targets: ["ETH", "SOL"],
      },
      mockMixedCoverageClient,
      mockConfig,
    );
    const effects = result["effects"] as Array<Record<string, unknown>>;
    const solEffect = effects.find((e) => e["target"] === "SOL");
    expect(solEffect).toBeDefined();
    expect(solEffect!["reasoning_mode"]).toBe("graph_propagation");
    expect(solEffect!["mechanism_coverage_complete"]).toBe(false);
  });

  it("per-effect: mixed targets can have different reasoning_modes", async () => {
    const { result } = await dispatch(
      "intervene.do",
      {
        interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }],
        targets: ["ETH", "SOL"],
      },
      mockMixedCoverageClient,
      mockConfig,
    );
    const effects = result["effects"] as Array<Record<string, unknown>>;
    const ethEffect = effects.find((e) => e["target"] === "ETH");
    const solEffect = effects.find((e) => e["target"] === "SOL");
    expect(ethEffect!["reasoning_mode"]).toBe("scm_simulation");
    expect(solEffect!["reasoning_mode"]).toBe("graph_propagation");
  });

  it("result-level: identification_status MUST be present", async () => {
    const { result } = await dispatch(
      "intervene.do",
      {
        interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }],
        targets: ["ETH"],
      },
      mockInterveneClient,
      mockConfig,
    );
    expect(result["identification_status"]).toBe("not_formally_identified");
  });

  it("result-level: assumptions MUST be present and non-empty", async () => {
    const { result } = await dispatch(
      "intervene.do",
      {
        interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }],
        targets: ["ETH"],
      },
      mockInterveneClient,
      mockConfig,
    );
    const assumptions = result["assumptions"] as unknown[];
    expect(Array.isArray(assumptions)).toBe(true);
    expect(assumptions.length).toBeGreaterThan(0);
    expect(assumptions).toContain("causal_sufficiency");
  });
});

// ── §6.6 Fallback honesty ────────────────────────────────────────────────────

describe("§6.6 Fallback honesty", () => {
  it("partial coverage targets MUST use graph_propagation, NOT scm_simulation", async () => {
    const { result } = await dispatch(
      "intervene.do",
      {
        interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }],
        targets: ["ETH", "SOL"],
      },
      mockMixedCoverageClient,
      mockConfig,
    );
    const effects = result["effects"] as Array<Record<string, unknown>>;
    for (const effect of effects) {
      if (effect["mechanism_coverage_complete"] === false) {
        expect(effect["reasoning_mode"]).not.toBe("scm_simulation");
      }
    }
  });
});
