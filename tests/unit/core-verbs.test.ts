import { describe, it, expect, vi } from "vitest";
import type { AbelClient } from "../../src/abel-client/client.js";
import type { Config } from "../../src/config.js";
import { metaCapabilitiesHandler } from "../../src/verbs/core/meta-capabilities.js";
import { graphNeighborsHandler } from "../../src/verbs/core/graph-neighbors.js";
import { graphPathsHandler } from "../../src/verbs/core/graph-paths.js";
import { effectQueryHandler } from "../../src/verbs/core/effect-query.js";
import { CAPError } from "../../src/cap/errors.js";

describe("meta.capabilities", () => {
  it("returns capability card with correct conformance level", async () => {
    const result = await metaCapabilitiesHandler.handle(
      {},
      {} as unknown as AbelClient,
      { port: 3001 } as unknown as Config
    );
    expect(result.result["conformance_level"]).toBe(2);
    expect(result.result["cap_spec_version"]).toBe("0.2.2");
    expect(result.result["name"]).toBe("Abel Social Physical Engine");
  });

  it("includes structural_mechanisms in causal_engine", async () => {
    const result = await metaCapabilitiesHandler.handle(
      {},
      {} as unknown as AbelClient,
      { port: 3001 } as unknown as Config
    );
    const engine = result.result["causal_engine"] as Record<string, unknown>;
    const mechs = engine["structural_mechanisms"] as Record<string, unknown>;
    expect(mechs["available"]).toBe(true);
    expect(mechs["mechanism_override_supported"]).toBe(true);
  });
});

describe("graph.neighbors", () => {
  const getFeaturesMock = vi.fn().mockResolvedValue({
    ticker: "BTC",
    features: [
      { feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2 },
      { feature_name: "SPX", feature_type: "macro_indicator", weight: 0.15, tau: 1 },
    ],
    intercept: 0.001,
  });
  const mockClient = {
    getFeatures: getFeaturesMock,
    getChildren: vi.fn().mockResolvedValue({
      ticker: "BTC",
      children: [{ child_name: "LINK", child_type: "asset_price", weight: 0.2, tau: 3 }],
    }),
  } as unknown as AbelClient;

  it("returns parents when direction=parents", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "parents" },
      mockClient,
      {} as unknown as Config
    );
    const neighbors = result.result["neighbors"] as Array<Record<string, unknown>>;
    expect(neighbors).toHaveLength(2);
    expect(neighbors[0]["node_id"]).toBe("ETH");
    expect(neighbors[0]["tau_duration"]).toBe("PT2H");
    expect(getFeaturesMock).toHaveBeenCalledWith("BTC");
  });

  it("returns children when direction=children", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "children" },
      mockClient,
      {} as unknown as Config
    );
    const neighbors = result.result["neighbors"] as Array<Record<string, unknown>>;
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0]["node_id"]).toBe("LINK");
  });

  it("returns both when direction=both", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "both" },
      mockClient,
      {} as unknown as Config
    );
    const neighbors = result.result["neighbors"] as Array<Record<string, unknown>>;
    expect(neighbors).toHaveLength(3);
  });

  it("respects top_k", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "parents", top_k: 1 },
      mockClient,
      {} as unknown as Config
    );
    const neighbors = result.result["neighbors"] as Array<Record<string, unknown>>;
    expect(neighbors).toHaveLength(1);
  });

  it("includes undetermined_neighbor_count: 0", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "parents" },
      mockClient,
      {} as unknown as Config
    );
    expect(result.result["undetermined_neighbor_count"]).toBe(0);
  });
});

describe("graph.paths", () => {
  // A→B→C graph
  type AbelChildEntry = {
    child_name: string;
    child_type: string;
    weight: number;
    tau: number;
  };
  const mockClient = {
    getChildren: vi.fn().mockImplementation(async (ticker: string) => {
      const graph: Record<string, AbelChildEntry[]> = {
        A: [{ child_name: "B", child_type: "asset_price", weight: 0.5, tau: 1 }],
        B: [{ child_name: "C", child_type: "asset_price", weight: 0.3, tau: 2 }],
        C: [],
      };
      return { ticker, children: graph[ticker] ?? [] };
    }),
  } as unknown as AbelClient;

  it("finds path from A to C", async () => {
    const result = await graphPathsHandler.handle(
      { source: "A", target: "C", max_depth: 5 },
      mockClient,
      {} as unknown as Config
    );
    const paths = result.result["paths"] as Array<Array<Record<string, unknown>>>;
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "A", to: "B" }),
        expect.objectContaining({ from: "B", to: "C" }),
      ])
    );
  });

  it("returns empty paths for unreachable target", async () => {
    const result = await graphPathsHandler.handle(
      { source: "C", target: "A", max_depth: 5 },
      mockClient,
      {} as unknown as Config
    );
    const paths = result.result["paths"] as Array<unknown>;
    expect(paths).toHaveLength(0);
  });
});

describe("effect.query", () => {
  const mockClient = {
    getPrediction: vi.fn().mockResolvedValue({
      ticker: "BTC",
      predicted_log_return: 0.023,
      probability_positive: 0.72,
      confidence_interval: [0.005, 0.041],
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
    }),
  } as unknown as AbelClient;

  it("returns observational prediction", async () => {
    const result = await effectQueryHandler.handle(
      { target: "BTC", query_type: "observational" },
      mockClient,
      {} as unknown as Config
    );
    expect(result.result["query_type"]).toBe("observational");
    const estimate = result.result["estimate"] as Record<string, unknown>;
    expect(estimate["value"]).toBe(0.023);
    expect(estimate["probability_positive"]).toBe(0.72);
  });

  it("rejects interventional with query_type_not_supported", async () => {
    // CAPError sets message to the human-readable string, not the code.
    // Check .code property instead of message string.
    await expect(
      effectQueryHandler.handle(
        {
          target: "BTC",
          query_type: "interventional",
          intervention: { node_id: "ETH", value: 0.05, unit: "log_return" },
        },
        mockClient,
        {} as unknown as Config
      )
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CAPError && err.code === "query_type_not_supported"
    );
  });

  it("includes provenance by default (§6.4: include_provenance defaults true)", async () => {
    const result = await effectQueryHandler.handle(
      { target: "BTC", query_type: "observational" },
      mockClient,
      {} as unknown as Config
    );
    expect(result.provenance).toBeDefined();
    expect(result.provenance?.graphVersion).toBe("dynamic");
    expect(result.provenance?.mechanismFamilyUsed).toBe("linear");
  });
});
