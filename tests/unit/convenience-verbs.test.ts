import { describe, it, expect, vi } from "vitest";
import type { AbelClient } from "../../src/abel-client/client.js";
import type { Config } from "../../src/config.js";
import { observePredictHandler } from "../../src/verbs/convenience/observe-predict.js";
import { observePredictMultiHandler } from "../../src/verbs/convenience/observe-predict-multi.js";
import { observePredictBatchHandler } from "../../src/verbs/convenience/observe-predict-batch.js";
import { observeAttributeHandler } from "../../src/verbs/convenience/observe-attribute.js";
import { metaGraphInfoHandler } from "../../src/verbs/convenience/meta-graph-info.js";
import { metaNodeInfoHandler } from "../../src/verbs/convenience/meta-node-info.js";
import { metaAlgorithmsHandler } from "../../src/verbs/convenience/meta-algorithms.js";
import { metaHealthHandler } from "../../src/verbs/convenience/meta-health.js";
import { traverseParentsHandler } from "../../src/verbs/convenience/traverse-parents.js";
import { traverseChildrenHandler } from "../../src/verbs/convenience/traverse-children.js";
import { traverseSubgraphHandler } from "../../src/verbs/convenience/traverse-subgraph.js";
import { traverseLatestHandler } from "../../src/verbs/convenience/traverse-latest.js";
import { interveneDoHandler } from "../../src/verbs/convenience/intervene-do.js";
import { CAPError } from "../../src/cap/errors.js";

const mockPrediction = {
  ticker: "BTC",
  predicted_log_return: 0.023,
  probability_positive: 0.72,
  confidence_interval: [0.005, 0.041] as [number, number],
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
  latest_value: 67000,
  latest_change_percent: 1.2,
  timestamp: "2026-03-12T00:00:00Z",
};

const mockClient = {
  getPrediction: vi.fn().mockResolvedValue(mockPrediction),
  getMultiStepPrediction: vi.fn().mockResolvedValue({
    ticker: "BTC",
    steps: [
      {
        step: 1,
        predicted_log_return: 0.01,
        cumulative_log_return: 0.01,
        probability_positive: 0.6,
      },
      {
        step: 2,
        predicted_log_return: 0.015,
        cumulative_log_return: 0.025,
        probability_positive: 0.65,
      },
    ],
    features: mockPrediction.features,
  }),
  getBatchPrediction: vi.fn().mockResolvedValue({
    results: [
      {
        ticker: "BTC",
        steps: [
          {
            step: 1,
            predicted_log_return: 0.01,
            cumulative_log_return: 0.01,
            probability_positive: 0.6,
          },
        ],
        features: [],
      },
      {
        ticker: "ETH",
        steps: [
          {
            step: 1,
            predicted_log_return: 0.02,
            cumulative_log_return: 0.02,
            probability_positive: 0.7,
          },
        ],
        features: [],
      },
    ],
  }),
  getFeatures: vi.fn().mockResolvedValue({
    ticker: "BTC",
    features: mockPrediction.features,
    intercept: 0.001,
    prediction: 0.023,
    probability_positive: 0.72,
  }),
} as unknown as AbelClient;

describe("observe.predict", () => {
  it("returns prediction with causal features", async () => {
    const result = await observePredictHandler.handle(
      { target: "BTC" },
      mockClient,
      {} as unknown as Config
    );
    expect(result.result["target"]).toBe("BTC");
    const pred = result.result["prediction"] as Record<string, unknown>;
    expect(pred["value"]).toBe(0.023);
    expect(pred["direction"]).toBe("up");
    expect((result.result["causal_features"] as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("observe.predict_multistep", () => {
  it("returns multi-step predictions", async () => {
    const result = await observePredictMultiHandler.handle(
      { target: "BTC" },
      mockClient,
      {} as unknown as Config
    );
    const steps = result.result["steps"] as Record<string, unknown>[];
    expect(steps).toHaveLength(2);
    expect(steps[1]["cumulative_log_return"]).toBe(0.025);
  });
});

describe("observe.predict_batch", () => {
  it("returns predictions for multiple tickers", async () => {
    const result = await observePredictBatchHandler.handle(
      { targets: ["BTC", "ETH"] },
      mockClient,
      {} as unknown as Config
    );
    const predictions = result.result["predictions"] as unknown[];
    expect(predictions).toHaveLength(2);
  });
});

describe("observe.attribute", () => {
  it("returns feature attribution decomposition", async () => {
    const result = await observeAttributeHandler.handle(
      { target: "BTC" },
      mockClient,
      {} as unknown as Config
    );
    const features = result.result["causal_features"] as Record<string, unknown>[];
    expect(features.length).toBeGreaterThan(0);
    expect(features[0]["impact_fraction"]).toBeGreaterThan(0);
  });
});

const healthClient = {
  getHealth: vi.fn().mockResolvedValue({
    status: "healthy",
    version: "1.0.0",
    graph_version: "v42",
    graph_timestamp: "2026-03-12T00:00:00Z",
    node_count: 450,
    edge_count: 3200,
  }),
  getFeatures: vi.fn().mockResolvedValue({
    ticker: "BTC",
    features: [{ feature_name: "ETH", feature_type: "asset_price", weight: 0.3, tau: 1 }],
  }),
  getChildren: vi.fn().mockResolvedValue({
    ticker: "BTC",
    children: [{ child_name: "LINK", child_type: "asset_price", weight: 0.2, tau: 2 }],
  }),
} as unknown as AbelClient;

describe("meta.graph_info", () => {
  it("returns graph summary", async () => {
    const result = await metaGraphInfoHandler.handle(
      {},
      healthClient,
      {} as unknown as Config
    );
    expect(result.result["node_count"]).toBe(450);
    expect(result.result["status"]).toBe("healthy");
  });
});

describe("meta.node_info", () => {
  it("returns node info with parents and children", async () => {
    const result = await metaNodeInfoHandler.handle(
      { node_id: "BTC" },
      healthClient,
      {} as unknown as Config
    );
    expect(result.result["node_id"]).toBe("BTC");
    expect((result.result["parents"] as unknown[]).length).toBe(1);
    expect((result.result["children"] as unknown[]).length).toBe(1);
  });
});

describe("meta.algorithms", () => {
  it("returns static PCMCI metadata", async () => {
    const result = await metaAlgorithmsHandler.handle(
      {},
      {} as unknown as AbelClient,
      {} as unknown as Config
    );
    expect(result.result["algorithm"]).toBe("PCMCI");
    expect(result.result["family"]).toBe("constraint-based");
  });
});

describe("meta.health", () => {
  it("returns health status", async () => {
    const result = await metaHealthHandler.handle(
      {},
      healthClient,
      {} as unknown as Config
    );
    expect(result.result["status"]).toBe("healthy");
  });
});

describe("traverse.parents", () => {
  it("returns parent neighbors", async () => {
    const result = await traverseParentsHandler.handle(
      { node_id: "BTC" },
      mockClient,
      {} as unknown as Config
    );
    expect(result.result["direction"]).toBe("parents");
    expect((result.result["neighbors"] as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("traverse.children", () => {
  it("returns child neighbors", async () => {
    const childClient = {
      getChildren: vi.fn().mockResolvedValue({
        ticker: "BTC",
        children: [
          { child_name: "LINK", child_type: "asset_price", weight: 0.2, tau: 3 },
        ],
      }),
    } as unknown as AbelClient;
    const result = await traverseChildrenHandler.handle(
      { node_id: "BTC" },
      childClient,
      {} as unknown as Config
    );
    expect(result.result["direction"]).toBe("children");
    const neighbors = result.result["neighbors"] as Record<string, unknown>[];
    expect(neighbors[0]["node_id"]).toBe("LINK");
  });
});

describe("traverse.subgraph", () => {
  const subgraphClient = {
    getFeatures: vi.fn().mockResolvedValue({
      ticker: "BTC",
      features: [
        { feature_name: "ETH", feature_type: "asset_price", weight: 0.3, tau: 1 },
      ],
    }),
    getChildren: vi.fn().mockResolvedValue({ ticker: "BTC", children: [] }),
  } as unknown as AbelClient;

  it("returns subgraph with nodes and edges", async () => {
    const result = await traverseSubgraphHandler.handle(
      { node_id: "BTC", depth: 1 },
      subgraphClient,
      { maxSubgraphEdges: 50 } as unknown as Config
    );
    expect(result.result["center"]).toBe("BTC");
    expect((result.result["nodes"] as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("traverse.latest_values", () => {
  it("returns latest values for nodes", async () => {
    const latestClient = {
      getLatestChange: vi.fn().mockResolvedValue({
        nodes: [
          {
            ticker: "BTC",
            node_type: "asset_price",
            latest_value: 67000,
            latest_change_percent: 1.2,
            timestamp: "2026-03-12T00:00:00Z",
          },
        ],
      }),
    } as unknown as AbelClient;
    const result = await traverseLatestHandler.handle(
      {},
      latestClient,
      {} as unknown as Config
    );
    const nodes = result.result["nodes"] as Record<string, unknown>[];
    expect(nodes[0]["node_id"]).toBe("BTC");
    expect(nodes[0]["latest_value"]).toBe(67000);
  });
});

// ── intervene.do ──────────────────────────────────────────────────────────────

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
      {
        target: "SOL",
        expected_change: 0.01,
        unit: "log_return",
        probability_positive: 0.6,
        propagation_delay_hours: 4,
        mechanism_coverage_complete: false,
      },
    ],
  }),
  getFeatures: vi.fn(),
  getChildren: vi.fn(),
  getPrediction: vi.fn(),
  getHealth: vi.fn(),
} as unknown as AbelClient;

const interveneParams = {
  interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }],
  targets: ["ETH", "SOL"],
};

describe("intervene.do", () => {
  it("returns effects with per-effect reasoning_mode", async () => {
    const result = await interveneDoHandler.handle(
      interveneParams,
      mockInterveneClient,
      {} as unknown as Config
    );
    const effects = result.result["effects"] as Record<string, unknown>[];
    expect(effects).toHaveLength(2);
    for (const effect of effects) {
      expect(effect["reasoning_mode"]).toBeDefined();
      expect(effect["mechanism_coverage_complete"]).toBeDefined();
    }
  });

  it("full mechanism coverage → scm_simulation + mechanism_coverage_complete=true", async () => {
    const result = await interveneDoHandler.handle(
      interveneParams,
      mockInterveneClient,
      {} as unknown as Config
    );
    const effects = result.result["effects"] as Record<string, unknown>[];
    const eth = effects.find((e) => e["target"] === "ETH")!;
    expect(eth["reasoning_mode"]).toBe("scm_simulation");
    expect(eth["mechanism_coverage_complete"]).toBe(true);
  });

  it("partial coverage → graph_propagation + mechanism_coverage_complete=false", async () => {
    const result = await interveneDoHandler.handle(
      interveneParams,
      mockInterveneClient,
      {} as unknown as Config
    );
    const effects = result.result["effects"] as Record<string, unknown>[];
    const sol = effects.find((e) => e["target"] === "SOL")!;
    expect(sol["reasoning_mode"]).toBe("graph_propagation");
    expect(sol["mechanism_coverage_complete"]).toBe(false);
  });

  it("mixed targets: one full coverage, one partial — different reasoning_modes", async () => {
    const result = await interveneDoHandler.handle(
      interveneParams,
      mockInterveneClient,
      {} as unknown as Config
    );
    const effects = result.result["effects"] as Record<string, unknown>[];
    const eth = effects.find((e) => e["target"] === "ETH")!;
    const sol = effects.find((e) => e["target"] === "SOL")!;
    expect(eth["reasoning_mode"]).not.toBe(sol["reasoning_mode"]);
  });

  it("result includes identification_status + assumptions", async () => {
    const result = await interveneDoHandler.handle(
      interveneParams,
      mockInterveneClient,
      {} as unknown as Config
    );
    expect(result.result["identification_status"]).toBe("not_formally_identified");
    const assumptions = result.result["assumptions"] as string[];
    expect(Array.isArray(assumptions)).toBe(true);
    expect(assumptions.length).toBeGreaterThan(0);
  });

  it("missing interventions → invalid_intervention CAPError", async () => {
    await expect(
      interveneDoHandler.handle(
        { interventions: [], targets: ["ETH"] },
        mockInterveneClient,
        {} as unknown as Config
      )
    ).rejects.toBeInstanceOf(CAPError);

    try {
      await interveneDoHandler.handle(
        { interventions: [], targets: ["ETH"] },
        mockInterveneClient,
        {} as unknown as Config
      );
    } catch (err) {
      expect((err as CAPError).code).toBe("invalid_intervention");
    }
  });

  it("missing targets → invalid_intervention CAPError", async () => {
    await expect(
      interveneDoHandler.handle(
        { interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }], targets: [] },
        mockInterveneClient,
        {} as unknown as Config
      )
    ).rejects.toBeInstanceOf(CAPError);

    try {
      await interveneDoHandler.handle(
        { interventions: [{ node_id: "BTC", value: 0.05, unit: "log_return" }], targets: [] },
        mockInterveneClient,
        {} as unknown as Config
      );
    } catch (err) {
      expect((err as CAPError).code).toBe("invalid_intervention");
    }
  });

  it("include_paths=false strips causal_path from effects", async () => {
    const result = await interveneDoHandler.handle(
      { ...interveneParams, include_paths: false },
      mockInterveneClient,
      {} as unknown as Config
    );
    const effects = result.result["effects"] as Record<string, unknown>[];
    for (const effect of effects) {
      expect(effect["causal_path"]).toBeUndefined();
    }
  });

  it("include_paths=true preserves causal_path when present", async () => {
    const result = await interveneDoHandler.handle(
      { ...interveneParams, include_paths: true },
      mockInterveneClient,
      {} as unknown as Config
    );
    const effects = result.result["effects"] as Record<string, unknown>[];
    const eth = effects.find((e) => e["target"] === "ETH")!;
    expect(Array.isArray(eth["causal_path"])).toBe(true);
  });

  it("echoes interventions in result", async () => {
    const result = await interveneDoHandler.handle(
      interveneParams,
      mockInterveneClient,
      {} as unknown as Config
    );
    const echoed = result.result["interventions"] as Record<string, unknown>[];
    expect(echoed).toHaveLength(1);
    expect(echoed[0]["node_id"]).toBe("BTC");
  });

  it("maps node_id to ticker when calling Abel client", async () => {
    const clientSpy = {
      ...mockInterveneClient,
      intervene: vi.fn().mockResolvedValue({
        interventions: [{ ticker: "BTC", value: 0.05, unit: "log_return" }],
        effects: [],
      }),
    } as unknown as AbelClient;

    await interveneDoHandler.handle(
      interveneParams,
      clientSpy,
      {} as unknown as Config
    );

    const callArg = (clientSpy.intervene as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
      interventions: Array<{ ticker: string }>;
    };
    expect(callArg.interventions[0]["ticker"]).toBe("BTC");
  });
});
