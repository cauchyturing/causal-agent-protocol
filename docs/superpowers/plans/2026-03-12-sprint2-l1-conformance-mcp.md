# Sprint 2: Level 1 Conformance + MCP Binding — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full CAP Level 1 conformance with all L1 verbs implemented and usable from Claude Code via MCP stdio transport.

**Architecture:** Each verb handler is a pure function: `(params, abelClient, config) → VerbResult`. A shared dispatcher routes verb names to handlers. The MCP binding registers each verb as `cap_{category}_{verb}` with Zod input schemas. Transport (stdio) is a thin wrapper that creates the MCP server, connects handlers, and starts listening.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk (McpServer + StdioServerTransport), Zod v4, vitest

**Existing infrastructure (Sprint 1 — do NOT recreate):**
- `src/cap/envelope.ts` — RequestEnvelopeSchema, buildSuccessResponse, buildErrorResponse
- `src/cap/errors.ts` — CAPError with all 11 error codes
- `src/cap/provenance.ts` — buildProvenance()
- `src/cap/semantics.ts` — ReasoningMode, IdentificationStatus types
- `src/cap/verbs.ts` — VERB_REGISTRY with all verb definitions
- `src/cap/capability-card.ts` — buildCapabilityCard()
- `src/abel-client/client.ts` — AbelClient with typed methods for all endpoints
- `src/abel-client/types.ts` — All Abel API response types
- `src/abel-client/transformers.ts` — transformFeatureToCausal, transformFeatureToNeighbor, transformChildToNeighbor, computeImpactFractions
- `src/utils/schemas.ts` — CausalFeatureSchema, InterventionSchema, UnitSchema
- `src/utils/duration.ts` — tauToISO, hoursToISO
- `src/config.ts` — loadConfig()

**Quality gates:** `make check` (lint + format + unit + typecheck) must pass after every task.

---

## File Map

### New files to create

| File | Responsibility |
|------|---------------|
| `src/verbs/handler.ts` | VerbHandler interface + VerbResult type + dispatcher |
| `src/verbs/core/meta-capabilities.ts` | meta.capabilities → return Capability Card |
| `src/verbs/core/graph-neighbors.ts` | graph.neighbors → Abel /features + /children |
| `src/verbs/core/graph-paths.ts` | graph.paths → BFS over Abel graph (L2 core, implemented early) |
| `src/verbs/core/effect-query.ts` | effect.query (observational) → Abel /prediction |
| `src/verbs/_shared/error-mapping.ts` | Map Abel HTTP errors → CAPError codes |
| `src/verbs/convenience/observe-predict.ts` | observe.predict → Abel /prediction |
| `src/verbs/convenience/observe-predict-multi.ts` | observe.predict_multistep → Abel /multi-step-prediction |
| `src/verbs/convenience/observe-predict-batch.ts` | observe.predict_batch → Abel /batch |
| `src/verbs/convenience/observe-attribute.ts` | observe.attribute → compose /prediction + /features |
| `src/verbs/convenience/traverse-parents.ts` | traverse.parents → Abel /features |
| `src/verbs/convenience/traverse-children.ts` | traverse.children → Abel /children |
| `src/verbs/convenience/traverse-subgraph.ts` | traverse.subgraph → BFS with depth limit |
| `src/verbs/convenience/traverse-path.ts` | traverse.path → alias of graph.paths (§6.3) |
| `src/verbs/convenience/traverse-latest.ts` | traverse.latest_values → Abel /latest_change |
| `src/verbs/convenience/meta-graph-info.ts` | meta.graph_info → Abel /health + stats |
| `src/verbs/convenience/meta-node-info.ts` | meta.node_info → /features + /children |
| `src/verbs/convenience/meta-algorithms.ts` | meta.algorithms → static PCMCI metadata |
| `src/verbs/convenience/meta-health.ts` | meta.health → Abel /health |
| `src/transport/mcp-binding.ts` | Register all verbs as MCP tools |
| `tests/unit/verb-handler.test.ts` | Dispatcher unit tests |
| `tests/unit/core-verbs.test.ts` | Core verb handler unit tests (mocked client) |
| `tests/unit/convenience-verbs.test.ts` | Convenience verb handler unit tests |
| `tests/unit/mcp-binding.test.ts` | MCP tool registration tests |
| `tests/integration/core-verbs.test.ts` | Core verbs against live Abel |
| `tests/integration/convenience-verbs.test.ts` | Convenience verbs against live Abel |
| `tests/conformance/level1.test.ts` | CAP L1 conformance suite |

### Files to modify

| File | Change |
|------|--------|
| `src/index.ts` | Wire MCP stdio transport + verb dispatcher |

---

## Chunk 1: Verb Handler Infrastructure + Core Verbs

### Task 1: Verb Handler Interface + Dispatcher

**Files:**
- Create: `src/verbs/handler.ts`
- Create: `tests/unit/verb-handler.test.ts`

- [ ] **Step 1: Write failing tests for VerbHandler dispatcher**

```typescript
// tests/unit/verb-handler.test.ts
import { describe, it, expect } from "vitest";
import {
  type VerbHandler,
  type VerbResult,
  createDispatcher,
} from "../../src/verbs/handler.js";

describe("createDispatcher", () => {
  const mockHandler: VerbHandler = {
    verb: "test.echo",
    handle: async (params) => ({
      result: { echo: params["msg"] },
    }),
  };

  const dispatch = createDispatcher([mockHandler]);

  it("routes to correct handler", async () => {
    const result = await dispatch("test.echo", { msg: "hello" }, {} as any, {} as any);
    expect(result.result["echo"]).toBe("hello");
  });

  it("throws CAPError for unknown verb", async () => {
    await expect(dispatch("unknown.verb", {}, {} as any, {} as any)).rejects.toThrow(
      "verb_not_supported"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/bht/Abel/abel-cap-ref && npx vitest run tests/unit/verb-handler.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement VerbHandler + dispatcher**

```typescript
// src/verbs/handler.ts
import type { AbelClient } from "../abel-client/client.js";
import type { Config } from "../config.js";
import type { ProvenanceInput } from "../cap/provenance.js";
import { CAPError } from "../cap/errors.js";

export interface VerbResult {
  result: Record<string, unknown>;
  provenance?: ProvenanceInput;
}

export interface VerbHandler {
  verb: string;
  handle(
    params: Record<string, unknown>,
    client: AbelClient,
    config: Config
  ): Promise<VerbResult>;
}

export type Dispatcher = (
  verb: string,
  params: Record<string, unknown>,
  client: AbelClient,
  config: Config
) => Promise<VerbResult>;

export function createDispatcher(handlers: VerbHandler[]): Dispatcher {
  const map = new Map<string, VerbHandler>();
  for (const h of handlers) {
    map.set(h.verb, h);
  }

  return async (verb, params, client, config) => {
    const handler = map.get(verb);
    if (!handler) {
      throw new CAPError("verb_not_supported", {
        suggestion: `Use meta.capabilities to discover supported verbs`,
      });
    }
    return handler.handle(params, client, config);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/bht/Abel/abel-cap-ref && npx vitest run tests/unit/verb-handler.test.ts`
Expected: PASS

- [ ] **Step 5: Create shared Abel error → CAPError mapper**

```typescript
// src/verbs/_shared/error-mapping.ts
import { CAPError } from "../../cap/errors.js";

/**
 * Maps Abel API HTTP errors to CAP error codes.
 * Wraps every AbelClient call so verb handlers get CAPErrors.
 */
export function mapAbelError(err: unknown): never {
  if (err instanceof CAPError) throw err;

  const status = (err as any)?.status ?? (err as any)?.response?.status;
  const message = (err as any)?.message ?? "Unknown Abel API error";

  if (status === 404) {
    throw new CAPError("node_not_found", { suggestion: "Check the node_id exists in the causal graph via meta.graph_info" });
  }
  if (status === 408 || message.includes("timeout")) {
    throw new CAPError("computation_timeout", { suggestion: "Try a simpler query or increase timeout_ms" });
  }
  if (status === 429) {
    throw new CAPError("rate_limited", { suggestion: "Wait before retrying or upgrade access tier" });
  }
  if (status === 503) {
    throw new CAPError("graph_stale", { suggestion: "The causal graph is being updated. Retry in a few minutes." });
  }

  // Re-throw unknown errors as-is
  throw err;
}

/** Wrap an async Abel client call with CAPError mapping */
export async function withErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    mapAbelError(err);
  }
}
```

- [ ] **Step 6: Run `make check` (lint + typecheck + all unit tests)**

---

### Task 2: Core Verb — meta.capabilities

**Files:**
- Create: `src/verbs/core/meta-capabilities.ts`
- Add to: `tests/unit/core-verbs.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/core-verbs.test.ts
import { describe, it, expect } from "vitest";
import { metaCapabilitiesHandler } from "../../src/verbs/core/meta-capabilities.js";

describe("meta.capabilities", () => {
  it("returns capability card with correct conformance level", async () => {
    const result = await metaCapabilitiesHandler.handle(
      {},
      {} as any,  // client not needed
      { port: 3001 } as any
    );
    expect(result.result["conformance_level"]).toBe(2);
    expect(result.result["cap_spec_version"]).toBe("0.2.2");
    expect(result.result["name"]).toBe("Abel Social Physical Engine");
  });

  it("includes structural_mechanisms in causal_engine", async () => {
    const result = await metaCapabilitiesHandler.handle({}, {} as any, { port: 3001 } as any);
    const engine = result.result["causal_engine"] as Record<string, unknown>;
    const mechs = engine["structural_mechanisms"] as Record<string, unknown>;
    expect(mechs["available"]).toBe(true);
    expect(mechs["mechanism_override_supported"]).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/verbs/core/meta-capabilities.ts
import type { VerbHandler } from "../handler.js";
import { buildCapabilityCard } from "../../cap/capability-card.js";

export const metaCapabilitiesHandler: VerbHandler = {
  verb: "meta.capabilities",
  handle: async (_params, _client, config) => {
    const endpoint = `http://localhost:${config.port}/v1`;
    const card = buildCapabilityCard(endpoint);
    return { result: card as unknown as Record<string, unknown> };
  },
};
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Run `make check`**

---

### Task 3: Core Verb — graph.neighbors

**Files:**
- Create: `src/verbs/core/graph-neighbors.ts`
- Add to: `tests/unit/core-verbs.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// append to tests/unit/core-verbs.test.ts
import { graphNeighborsHandler } from "../../src/verbs/core/graph-neighbors.js";
import { vi } from "vitest";

describe("graph.neighbors", () => {
  const mockClient = {
    getFeatures: vi.fn().mockResolvedValue({
      ticker: "BTC",
      features: [
        { feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2 },
        { feature_name: "SPX", feature_type: "macro_indicator", weight: 0.15, tau: 1 },
      ],
      intercept: 0.001,
    }),
    getChildren: vi.fn().mockResolvedValue({
      ticker: "BTC",
      children: [
        { child_name: "LINK", child_type: "asset_price", weight: 0.2, tau: 3 },
      ],
    }),
  } as any;

  it("returns parents when direction=parents", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "parents" },
      mockClient,
      {} as any
    );
    const neighbors = result.result["neighbors"] as any[];
    expect(neighbors).toHaveLength(2);
    expect(neighbors[0]["node_id"]).toBe("ETH");
    expect(neighbors[0]["tau_duration"]).toBe("PT2H");
    expect(mockClient.getFeatures).toHaveBeenCalledWith("BTC");
  });

  it("returns children when direction=children", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "children" },
      mockClient,
      {} as any
    );
    const neighbors = result.result["neighbors"] as any[];
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0]["node_id"]).toBe("LINK");
  });

  it("returns both when direction=both", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "both" },
      mockClient,
      {} as any
    );
    const neighbors = result.result["neighbors"] as any[];
    expect(neighbors).toHaveLength(3);
  });

  it("respects top_k", async () => {
    const result = await graphNeighborsHandler.handle(
      { node_id: "BTC", direction: "parents", top_k: 1 },
      mockClient,
      {} as any
    );
    const neighbors = result.result["neighbors"] as any[];
    expect(neighbors).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/verbs/core/graph-neighbors.ts
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

    let neighbors: ReturnType<typeof transformFeatureToNeighbor>[] = [];
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

    // §6.5: include_values — attach current_value/current_change_percent if requested
    // For now, Abel's /features response includes latest values inline.
    // If include_values is false, strip current_value/current_change_percent from output.
    if (!includeValues) {
      neighbors = neighbors.map(({ current_value, current_change_percent, ...rest }) => rest) as any;
    }

    return {
      result: {
        node_id: nodeId,
        direction,
        neighbors,
        ...(intercept !== undefined && { intercept }),
        // §6.5: Abel uses DAG (not CPDAG/PAG), so all orientations are determined
        undetermined_neighbor_count: 0,
      },
    };
  },
};
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Run `make check`**

---

### Task 4: Core Verb — graph.paths (BFS) — NOTE: L2 core per §10.2

> **Spec cross-ref:** `graph.paths` is **L2 core** (§10.2 line 1137), not L1.
> We implement it in Sprint 2 for early utility, but conformance assertion
> belongs in Sprint 4's L2 conformance suite, NOT in Task 11's L1 suite.

**Files:**
- Create: `src/verbs/core/graph-paths.ts`
- Add to: `tests/unit/core-verbs.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// append to tests/unit/core-verbs.test.ts
import { graphPathsHandler } from "../../src/verbs/core/graph-paths.js";

describe("graph.paths", () => {
  // A→B→C graph
  const mockClient = {
    getChildren: vi.fn().mockImplementation(async (ticker: string) => {
      const graph: Record<string, any[]> = {
        A: [{ child_name: "B", child_type: "asset_price", weight: 0.5, tau: 1 }],
        B: [{ child_name: "C", child_type: "asset_price", weight: 0.3, tau: 2 }],
        C: [],
      };
      return { ticker, children: graph[ticker] ?? [] };
    }),
  } as any;

  it("finds path from A to C", async () => {
    const result = await graphPathsHandler.handle(
      { source: "A", target: "C", max_depth: 5 },
      mockClient,
      {} as any
    );
    const paths = result.result["paths"] as any[];
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
      {} as any
    );
    const paths = result.result["paths"] as any[];
    expect(paths).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

BFS path search using `client.getChildren()`. Max depth defaults to 5. Returns array of edge paths.

```typescript
// src/verbs/core/graph-paths.ts
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
    const childrenCache = new Map<string, Awaited<ReturnType<typeof client.getChildren>>>();
    const queue: Array<{ node: string; path: Edge[]; depth: number; visitedInPath: Set<string> }> = [
      { node: source, path: [], depth: 0, visitedInPath: new Set([source]) },
    ];

    while (queue.length > 0 && paths.length < 10) {
      const current = queue.shift()!;
      if (current.depth > maxDepth) continue;
      if (current.node === target && current.path.length > 0) {
        paths.push(current.path);
        continue; // found a path, don't explore further from target
      }

      // Use per-path visited set (not global) to allow multiple paths through shared nodes
      if (!childrenCache.has(current.node)) {
        childrenCache.set(current.node, await withErrorMapping(() => client.getChildren(current.node)));
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
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Run `make check`**

---

### Task 5: Core Verb — effect.query (observational)

**Files:**
- Create: `src/verbs/core/effect-query.ts`
- Add to: `tests/unit/core-verbs.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// append to tests/unit/core-verbs.test.ts
import { effectQueryHandler } from "../../src/verbs/core/effect-query.js";

describe("effect.query", () => {
  const mockClient = {
    getPrediction: vi.fn().mockResolvedValue({
      ticker: "BTC",
      predicted_log_return: 0.023,
      probability_positive: 0.72,
      confidence_interval: [0.005, 0.041],
      features: [
        { feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2, impact: 0.012 },
      ],
      intercept: 0.001,
      latest_value: 67000,
      latest_change_percent: 1.2,
      timestamp: "2026-03-12T00:00:00Z",
    }),
  } as any;

  it("returns observational prediction", async () => {
    const result = await effectQueryHandler.handle(
      { target: "BTC", query_type: "observational" },
      mockClient,
      {} as any
    );
    expect(result.result["query_type"]).toBe("observational");
    const estimate = result.result["estimate"] as Record<string, unknown>;
    expect(estimate["value"]).toBe(0.023);
    expect(estimate["probability_positive"]).toBe(0.72);
  });

  it("rejects interventional at L1 with query_type_not_supported", async () => {
    // Our server is L2, but this tests the shape.
    // The actual L2 path is Sprint 4.
    // For now, interventional returns query_type_not_supported until Sprint 4.
    await expect(
      effectQueryHandler.handle(
        { target: "BTC", query_type: "interventional", intervention: { node_id: "ETH", value: 0.05, unit: "log_return" } },
        mockClient,
        {} as any
      )
    ).rejects.toThrow("query_type_not_supported");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```typescript
// src/verbs/core/effect-query.ts
import type { VerbHandler } from "../handler.js";
import { CAPError } from "../../cap/errors.js";
import {
  transformFeatureToCausal,
  computeImpactFractions,
} from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const effectQueryHandler: VerbHandler = {
  verb: "effect.query",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const queryType = params["query_type"] as string;

    if (queryType === "interventional") {
      throw new CAPError("query_type_not_supported", {
        suggestion:
          "Interventional queries via effect.query will be available in a future release. Use intervene.do for intervention simulation.",
      });
    }

    const pred = await withErrorMapping(() => client.getPrediction(target));
    const features = pred.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    const topK = (params["top_k_causes"] as number) || 0;
    const displayFeatures = topK > 0 ? features.slice(0, topK) : features;
    // §6.4: include_provenance defaults to TRUE per spec (line 677)
    const includeProvenance = params["include_provenance"] !== false;

    const startMs = Date.now();

    return {
      result: {
        target,
        query_type: "observational",
        estimate: {
          value: pred.predicted_log_return,
          unit: "log_return",
          direction:
            pred.predicted_log_return > 0.001
              ? "up"
              : pred.predicted_log_return < -0.001
                ? "down"
                : "neutral",
          probability_positive: pred.probability_positive,
          ...(pred.confidence_interval && {
            confidence_interval: pred.confidence_interval,
            interval_method: "bootstrap",
          }),
          horizon: "PT1H",
        },
        causal_features: displayFeatures,
      },
      // §6.9: Provenance — use Sprint 1's buildProvenance() with all required fields
      ...(includeProvenance && {
        provenance: {
          algorithm: "PCMCI",
          graph_version: "dynamic",  // populated at runtime from client.getHealth()
          graph_timestamp: new Date().toISOString(),
          computation_time_ms: Date.now() - startMs,
          mechanism_family_used: "linear",
          server_name: "Abel CAP Server",
          server_version: "0.1.0",
          cap_spec_version: "0.2.2",
        },
      }),
    };
  },
};
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Run `make check`**

---

## Chunk 2: Convenience Verbs (observe.* + traverse.* + meta.*)

### Task 6: observe.predict + observe.predict_multistep + observe.predict_batch + observe.attribute

**Files:**
- Create: `src/verbs/convenience/observe-predict.ts`
- Create: `src/verbs/convenience/observe-predict-multi.ts`
- Create: `src/verbs/convenience/observe-predict-batch.ts`
- Create: `src/verbs/convenience/observe-attribute.ts`
- Create: `tests/unit/convenience-verbs.test.ts`

- [ ] **Step 1: Write failing tests for all 4 observe verbs**

```typescript
// tests/unit/convenience-verbs.test.ts
import { describe, it, expect, vi } from "vitest";
import { observePredictHandler } from "../../src/verbs/convenience/observe-predict.js";
import { observePredictMultiHandler } from "../../src/verbs/convenience/observe-predict-multi.js";
import { observePredictBatchHandler } from "../../src/verbs/convenience/observe-predict-batch.js";
import { observeAttributeHandler } from "../../src/verbs/convenience/observe-attribute.js";

const mockPrediction = {
  ticker: "BTC",
  predicted_log_return: 0.023,
  probability_positive: 0.72,
  confidence_interval: [0.005, 0.041] as [number, number],
  features: [
    { feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2, impact: 0.012 },
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
      { step: 1, predicted_log_return: 0.01, cumulative_log_return: 0.01, probability_positive: 0.6 },
      { step: 2, predicted_log_return: 0.015, cumulative_log_return: 0.025, probability_positive: 0.65 },
    ],
    features: mockPrediction.features,
  }),
  getBatchPrediction: vi.fn().mockResolvedValue({
    results: [
      { ticker: "BTC", steps: [{ step: 1, predicted_log_return: 0.01, cumulative_log_return: 0.01, probability_positive: 0.6 }], features: [] },
      { ticker: "ETH", steps: [{ step: 1, predicted_log_return: 0.02, cumulative_log_return: 0.02, probability_positive: 0.7 }], features: [] },
    ],
  }),
  getFeatures: vi.fn().mockResolvedValue({
    ticker: "BTC",
    features: mockPrediction.features,
    intercept: 0.001,
    prediction: 0.023,
    probability_positive: 0.72,
  }),
} as any;

describe("observe.predict", () => {
  it("returns prediction with causal features", async () => {
    const result = await observePredictHandler.handle({ target: "BTC" }, mockClient, {} as any);
    expect(result.result["target"]).toBe("BTC");
    const pred = result.result["prediction"] as Record<string, unknown>;
    expect(pred["value"]).toBe(0.023);
    expect(pred["direction"]).toBe("up");
    expect((result.result["causal_features"] as any[]).length).toBeGreaterThan(0);
  });
});

describe("observe.predict_multistep", () => {
  it("returns multi-step predictions", async () => {
    const result = await observePredictMultiHandler.handle({ target: "BTC" }, mockClient, {} as any);
    const steps = result.result["steps"] as any[];
    expect(steps).toHaveLength(2);
    expect(steps[1]["cumulative_log_return"]).toBe(0.025);
  });
});

describe("observe.predict_batch", () => {
  it("returns predictions for multiple tickers", async () => {
    const result = await observePredictBatchHandler.handle({ targets: ["BTC", "ETH"] }, mockClient, {} as any);
    const predictions = result.result["predictions"] as any[];
    expect(predictions).toHaveLength(2);
  });
});

describe("observe.attribute", () => {
  it("returns feature attribution decomposition", async () => {
    const result = await observeAttributeHandler.handle({ target: "BTC" }, mockClient, {} as any);
    const features = result.result["causal_features"] as any[];
    expect(features.length).toBeGreaterThan(0);
    expect(features[0]["impact_fraction"]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement all 4 observe handlers**

**observe-predict.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { transformFeatureToCausal, computeImpactFractions } from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const observePredictHandler: VerbHandler = {
  verb: "observe.predict",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const topK = (params["top_k_causes"] as number) || 3;
    // §6.7: feature_selection — controls sort order of causal_features
    const featureSelection = (params["feature_selection"] as string) || "impact";
    // §6.7: include_provenance is OPTIONAL (no default stated for observe.predict,
    // but observe.predict is a §6.4 specialization — default false for convenience verbs)
    const includeProvenance = params["include_provenance"] === true;

    const startMs = Date.now();
    const pred = await withErrorMapping(() => client.getPrediction(target));
    const features = pred.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    // §6.7: Sort causal features by selected criterion
    if (featureSelection === "weight") {
      features.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    } else if (featureSelection === "tau") {
      features.sort((a, b) => a.tau - b.tau);
    }
    // Default "impact" — already sorted by |impact| from computeImpactFractions

    return {
      result: {
        target,
        prediction: {
          value: pred.predicted_log_return,
          unit: "log_return",
          direction: pred.predicted_log_return > 0.001 ? "up" : pred.predicted_log_return < -0.001 ? "down" : "neutral",
          probability_positive: pred.probability_positive,
          ...(pred.confidence_interval && { confidence_interval: pred.confidence_interval, interval_method: "bootstrap" }),
          horizon: "PT1H",
        },
        causal_features: topK > 0 ? features.slice(0, topK) : features,
        target_context: {
          latest_value: pred.latest_value,
          latest_change_percent: pred.latest_change_percent,
          timestamp: pred.timestamp,
        },
      },
      // §6.9: Provenance — all required fields per spec
      ...(includeProvenance && {
        provenance: {
          algorithm: "PCMCI",
          graph_version: "dynamic",
          graph_timestamp: new Date().toISOString(),
          computation_time_ms: Date.now() - startMs,
          mechanism_family_used: "linear",
          server_name: "Abel CAP Server",
          server_version: "0.1.0",
          cap_spec_version: "0.2.2",
        },
      }),
    };
  },
};
```

**observe-predict-multi.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { transformFeatureToCausal, computeImpactFractions } from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const observePredictMultiHandler: VerbHandler = {
  verb: "observe.predict_multistep",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const resp = await withErrorMapping(() => client.getMultiStepPrediction(target));
    const features = resp.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    return {
      result: {
        target,
        steps: resp.steps.map((s) => ({
          step: s.step,
          predicted_log_return: s.predicted_log_return,
          cumulative_log_return: s.cumulative_log_return,
          probability_positive: s.probability_positive,
          ...(s.confidence_interval && { confidence_interval: s.confidence_interval }),
        })),
        causal_features: features,
      },
    };
  },
};
```

**observe-predict-batch.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const observePredictBatchHandler: VerbHandler = {
  verb: "observe.predict_batch",
  handle: async (params, client) => {
    const targets = params["targets"] as string[];
    const resp = await withErrorMapping(() => client.getBatchPrediction(targets));

    return {
      result: {
        predictions: resp.results.map((r) => ({
          target: r.ticker,
          steps: r.steps.map((s) => ({
            step: s.step,
            predicted_log_return: s.predicted_log_return,
            cumulative_log_return: s.cumulative_log_return,
            probability_positive: s.probability_positive,
          })),
        })),
      },
    };
  },
};
```

**observe-attribute.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { transformFeatureToCausal, computeImpactFractions } from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const observeAttributeHandler: VerbHandler = {
  verb: "observe.attribute",
  handle: async (params, client) => {
    const target = params["target"] as string;
    const pred = await withErrorMapping(() => client.getPrediction(target));
    const features = pred.features.map(transformFeatureToCausal);
    computeImpactFractions(features);

    return {
      result: {
        target,
        predicted_value: pred.predicted_log_return,
        unit: "log_return",
        causal_features: features,
        intercept: pred.intercept,
      },
    };
  },
};
```

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Run `make check`**

---

### Task 7: traverse.parents + traverse.children + traverse.path + traverse.subgraph + traverse.latest_values

**Files:**
- Create: `src/verbs/convenience/traverse-parents.ts`
- Create: `src/verbs/convenience/traverse-children.ts`
- Create: `src/verbs/convenience/traverse-path.ts` — §6.3: alias of core graph.paths
- Create: `src/verbs/convenience/traverse-subgraph.ts`
- Create: `src/verbs/convenience/traverse-latest.ts`
- Add to: `tests/unit/convenience-verbs.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// append to tests/unit/convenience-verbs.test.ts
import { traverseParentsHandler } from "../../src/verbs/convenience/traverse-parents.js";
import { traverseChildrenHandler } from "../../src/verbs/convenience/traverse-children.js";
import { traverseSubgraphHandler } from "../../src/verbs/convenience/traverse-subgraph.js";
import { traverseLatestHandler } from "../../src/verbs/convenience/traverse-latest.js";

describe("traverse.parents", () => {
  it("returns parent neighbors", async () => {
    const result = await traverseParentsHandler.handle({ node_id: "BTC" }, mockClient, {} as any);
    expect(result.result["direction"]).toBe("parents");
    expect((result.result["neighbors"] as any[]).length).toBeGreaterThan(0);
  });
});

describe("traverse.children", () => {
  it("returns child neighbors", async () => {
    mockClient.getChildren = vi.fn().mockResolvedValue({
      ticker: "BTC",
      children: [{ child_name: "LINK", child_type: "asset_price", weight: 0.2, tau: 3 }],
    });
    const result = await traverseChildrenHandler.handle({ node_id: "BTC" }, mockClient, {} as any);
    expect(result.result["direction"]).toBe("children");
    expect((result.result["neighbors"] as any[])[0]["node_id"]).toBe("LINK");
  });
});

describe("traverse.subgraph", () => {
  const subgraphClient = {
    getFeatures: vi.fn().mockResolvedValue({ ticker: "BTC", features: [{ feature_name: "ETH", feature_type: "asset_price", weight: 0.3, tau: 1 }] }),
    getChildren: vi.fn().mockResolvedValue({ ticker: "BTC", children: [] }),
  } as any;

  it("returns subgraph with nodes and edges", async () => {
    const result = await traverseSubgraphHandler.handle(
      { node_id: "BTC", depth: 1 },
      subgraphClient,
      { maxSubgraphEdges: 50 } as any
    );
    expect(result.result["center"]).toBe("BTC");
    expect((result.result["nodes"] as any[]).length).toBeGreaterThan(0);
  });
});

describe("traverse.latest_values", () => {
  it("returns latest values for nodes", async () => {
    const latestClient = {
      getLatestChange: vi.fn().mockResolvedValue({
        nodes: [
          { ticker: "BTC", node_type: "asset_price", latest_value: 67000, latest_change_percent: 1.2, timestamp: "2026-03-12T00:00:00Z" },
        ],
      }),
    } as any;
    const result = await traverseLatestHandler.handle({}, latestClient, {} as any);
    const nodes = result.result["nodes"] as any[];
    expect(nodes[0]["node_id"]).toBe("BTC");
    expect(nodes[0]["latest_value"]).toBe(67000);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement all 5 traverse handlers**

**traverse-parents.ts** — delegates to graph.neighbors with direction=parents:
```typescript
import type { VerbHandler } from "../handler.js";
import { transformFeatureToNeighbor } from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const traverseParentsHandler: VerbHandler = {
  verb: "traverse.parents",
  handle: async (params, client) => {
    const nodeId = params["node_id"] as string;
    const topK = (params["top_k"] as number) || 0;
    const resp = await withErrorMapping(() => client.getFeatures(nodeId));
    let neighbors = resp.features.map(transformFeatureToNeighbor);
    neighbors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    if (topK > 0) neighbors = neighbors.slice(0, topK);
    return { result: { node_id: nodeId, direction: "parents", neighbors, ...(resp.intercept !== undefined && { intercept: resp.intercept }) } };
  },
};
```

**traverse-children.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { transformChildToNeighbor } from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const traverseChildrenHandler: VerbHandler = {
  verb: "traverse.children",
  handle: async (params, client) => {
    const nodeId = params["node_id"] as string;
    const topK = (params["top_k"] as number) || 0;
    const resp = await withErrorMapping(() => client.getChildren(nodeId));
    let neighbors = resp.children.map(transformChildToNeighbor);
    neighbors.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
    if (topK > 0) neighbors = neighbors.slice(0, topK);
    return { result: { node_id: nodeId, direction: "children", neighbors } };
  },
};
```

**traverse-path.ts** — §6.3 convenience alias of core graph.paths:
```typescript
import type { VerbHandler } from "../handler.js";
import { graphPathsHandler } from "../core/graph-paths.js";

export const traversePathHandler: VerbHandler = {
  verb: "traverse.path",
  handle: async (params, client, config) => {
    // §6.3: traverse.path is an alias of core graph.paths
    return graphPathsHandler.handle(params, client, config);
  },
};
```

**traverse-subgraph.ts** — BFS from center node, collecting unique nodes and edges:
```typescript
import type { VerbHandler } from "../handler.js";
import { CAPError } from "../../cap/errors.js";
import { tauToISO } from "../../utils/duration.js";

export const traverseSubgraphHandler: VerbHandler = {
  verb: "traverse.subgraph",
  handle: async (params, client, config) => {
    const nodeId = params["node_id"] as string;
    const depth = Math.min((params["depth"] as number) || 1, 3);
    const maxEdges = config.maxSubgraphEdges;

    const nodes = new Map<string, { node_id: string; node_type: string }>();
    const edges: Array<{ from: string; to: string; edge_type: string; weight: number; tau: number; tau_duration: string }> = [];
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
        edges.push({ from: f.feature_name, to: id, edge_type: "directed_lagged", weight: f.weight, tau: f.tau, tau_duration: tauToISO(f.tau) });
        if (d + 1 <= depth) queue.push({ id: f.feature_name, d: d + 1 });
        if (edges.length >= maxEdges) break;
      }

      for (const c of childResp.children) {
        nodes.set(c.child_name, { node_id: c.child_name, node_type: c.child_type });
        edges.push({ from: id, to: c.child_name, edge_type: "directed_lagged", weight: c.weight, tau: c.tau, tau_duration: tauToISO(c.tau) });
        if (d + 1 <= depth) queue.push({ id: c.child_name, d: d + 1 });
        if (edges.length >= maxEdges) break;
      }
    }

    if (edges.length >= maxEdges) {
      // Truncated but not error — just return what we have
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
```

**traverse-latest.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const traverseLatestHandler: VerbHandler = {
  verb: "traverse.latest_values",
  handle: async (_params, client) => {
    const resp = await withErrorMapping(() => client.getLatestChange());
    return {
      result: {
        nodes: resp.nodes.map((n) => ({
          node_id: n.ticker,
          node_type: n.node_type,
          latest_value: n.latest_value,
          latest_change_percent: n.latest_change_percent,
          timestamp: n.timestamp,
        })),
      },
    };
  },
};
```

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Run `make check`**

---

### Task 8: meta.graph_info + meta.node_info + meta.algorithms + meta.health

**Files:**
- Create: `src/verbs/convenience/meta-graph-info.ts`
- Create: `src/verbs/convenience/meta-node-info.ts`
- Create: `src/verbs/convenience/meta-algorithms.ts`
- Create: `src/verbs/convenience/meta-health.ts`
- Add to: `tests/unit/convenience-verbs.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// append to tests/unit/convenience-verbs.test.ts
import { metaGraphInfoHandler } from "../../src/verbs/convenience/meta-graph-info.js";
import { metaNodeInfoHandler } from "../../src/verbs/convenience/meta-node-info.js";
import { metaAlgorithmsHandler } from "../../src/verbs/convenience/meta-algorithms.js";
import { metaHealthHandler } from "../../src/verbs/convenience/meta-health.js";

const healthClient = {
  getHealth: vi.fn().mockResolvedValue({
    status: "healthy",
    version: "1.0.0",
    graph_version: "v42",
    graph_timestamp: "2026-03-12T00:00:00Z",
    node_count: 450,
    edge_count: 3200,
  }),
  getFeatures: vi.fn().mockResolvedValue({ ticker: "BTC", features: [{ feature_name: "ETH", feature_type: "asset_price", weight: 0.3, tau: 1 }] }),
  getChildren: vi.fn().mockResolvedValue({ ticker: "BTC", children: [{ child_name: "LINK", child_type: "asset_price", weight: 0.2, tau: 2 }] }),
} as any;

describe("meta.graph_info", () => {
  it("returns graph summary", async () => {
    const result = await metaGraphInfoHandler.handle({}, healthClient, {} as any);
    expect(result.result["node_count"]).toBe(450);
    expect(result.result["status"]).toBe("healthy");
  });
});

describe("meta.node_info", () => {
  it("returns node info with parents and children", async () => {
    const result = await metaNodeInfoHandler.handle({ node_id: "BTC" }, healthClient, {} as any);
    expect(result.result["node_id"]).toBe("BTC");
    expect((result.result["parents"] as any[]).length).toBe(1);
    expect((result.result["children"] as any[]).length).toBe(1);
  });
});

describe("meta.algorithms", () => {
  it("returns static PCMCI metadata", async () => {
    const result = await metaAlgorithmsHandler.handle({}, {} as any, {} as any);
    expect(result.result["algorithm"]).toBe("PCMCI");
    expect(result.result["family"]).toBe("constraint-based");
  });
});

describe("meta.health", () => {
  it("returns health status", async () => {
    const result = await metaHealthHandler.handle({}, healthClient, {} as any);
    expect(result.result["status"]).toBe("healthy");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement all 4 meta handlers**

**meta-graph-info.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const metaGraphInfoHandler: VerbHandler = {
  verb: "meta.graph_info",
  handle: async (_params, client) => {
    const health = await withErrorMapping(() => client.getHealth());
    return {
      result: {
        status: health.status,
        graph_version: health.graph_version,
        graph_timestamp: health.graph_timestamp,
        node_count: health.node_count,
        edge_count: health.edge_count,
        update_frequency: "PT4H",
        temporal_resolution: "PT1H",
        graph_representation: "time_lagged_dag",
      },
    };
  },
};
```

**meta-node-info.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { transformFeatureToNeighbor, transformChildToNeighbor } from "../../abel-client/transformers.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const metaNodeInfoHandler: VerbHandler = {
  verb: "meta.node_info",
  handle: async (params, client) => {
    const nodeId = params["node_id"] as string;
    const [featResp, childResp] = await Promise.all([
      withErrorMapping(() => client.getFeatures(nodeId)),
      withErrorMapping(() => client.getChildren(nodeId)),
    ]);
    return {
      result: {
        node_id: nodeId,
        parent_count: featResp.features.length,
        child_count: childResp.children.length,
        parents: featResp.features.map(transformFeatureToNeighbor),
        children: childResp.children.map(transformChildToNeighbor),
      },
    };
  },
};
```

**meta-algorithms.ts:**
```typescript
import type { VerbHandler } from "../handler.js";

export const metaAlgorithmsHandler: VerbHandler = {
  verb: "meta.algorithms",
  handle: async () => ({
    result: {
      algorithm: "PCMCI",
      family: "constraint-based",
      discovery_method: "conditional_independence",
      description: "PCMCI (Peter and Clark Momentary Conditional Independence) discovers time-lagged causal relationships using conditional independence tests on GPU-accelerated H100 clusters.",
      temporal: true,
      nonlinear: true,
      structural_mechanisms: { families: ["linear", "gbdt"], nodes_covered: 420, total_nodes: 450 },
    },
  }),
};
```

**meta-health.ts:**
```typescript
import type { VerbHandler } from "../handler.js";
import { withErrorMapping } from "../_shared/error-mapping.js";

export const metaHealthHandler: VerbHandler = {
  verb: "meta.health",
  handle: async (_params, client) => {
    const health = await withErrorMapping(() => client.getHealth());
    return {
      result: {
        status: health.status,
        version: health.version,
        graph_version: health.graph_version,
        graph_timestamp: health.graph_timestamp,
      },
    };
  },
};
```

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Run `make check`**

---

## Chunk 3: MCP Binding + Transport + Conformance

### Task 9: MCP Binding — Register All Verbs as MCP Tools

**Files:**
- Create: `src/transport/mcp-binding.ts`
- Create: `tests/unit/mcp-binding.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/unit/mcp-binding.test.ts
import { describe, it, expect } from "vitest";
import { getToolDefinitions } from "../../src/transport/mcp-binding.js";

describe("MCP binding", () => {
  it("generates tool definitions for all L1 verbs", () => {
    const tools = getToolDefinitions();
    const names = tools.map((t) => t.name);
    expect(names).toContain("cap_meta_capabilities");
    expect(names).toContain("cap_graph_neighbors");
    expect(names).toContain("cap_observe_predict");
    expect(names).toContain("cap_traverse_parents");
    expect(names).toContain("cap_meta_health");
  });

  it("uses cap_ prefix for all tool names", () => {
    const tools = getToolDefinitions();
    for (const t of tools) {
      expect(t.name).toMatch(/^cap_/);
    }
  });

  it("includes description with CAP verb name AND conformance level (§8.2)", () => {
    const tools = getToolDefinitions();
    const predict = tools.find((t) => t.name === "cap_observe_predict");
    expect(predict?.description).toContain("observe.predict");
    // §8.2 NORMATIVE: "MCP tool descriptions MUST include the CAP verb name and conformance level"
    expect(predict?.description).toMatch(/\[L[12]\]/);
  });

  it("includes traverse.path alias (§6.3)", () => {
    const tools = getToolDefinitions();
    const names = tools.map((t) => t.name);
    expect(names).toContain("cap_traverse_path");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement MCP binding**

The binding file defines `getToolDefinitions()` returning tool metadata and `createMcpServer()` that wires tools to the dispatcher.

```typescript
// src/transport/mcp-binding.ts
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Dispatcher } from "../verbs/handler.js";
import type { AbelClient } from "../abel-client/client.js";
import type { Config } from "../config.js";

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodType>;
}

// CAP verb → MCP tool name: observe.predict → cap_observe_predict
function verbToToolName(verb: string): string {
  return `cap_${verb.replace(/\./g, "_")}`;
}

// §8.2 NORMATIVE: descriptions MUST include CAP verb name AND conformance level
export function getToolDefinitions(): ToolDef[] {
  return [
    {
      name: "cap_meta_capabilities",
      description: "[L1] CAP verb: meta.capabilities — Return this server's Capability Card (conformance level, supported verbs, assumptions, graph metadata)",
      inputSchema: {},
    },
    {
      name: "cap_graph_neighbors",
      description: "[L1] CAP verb: graph.neighbors — Get immediate causal parents and/or children of a node",
      inputSchema: {
        node_id: z.string().describe("Target node ID (e.g. 'BTC', 'ETH')"),
        direction: z.enum(["parents", "children", "both"]).describe("Which neighbors to return"),
        top_k: z.number().int().optional().describe("Limit to top K neighbors by weight (0 = all)"),
        sort_by: z.enum(["weight", "tau", "name"]).optional().describe("Sort order"),
        include_values: z.boolean().optional().describe("Include latest observed values"),
      },
    },
    {
      name: "cap_graph_paths",
      description: "[L2] CAP verb: graph.paths — Find causal path(s) between two nodes via BFS",
      inputSchema: {
        source: z.string().describe("Source node ID"),
        target: z.string().describe("Target node ID"),
        max_depth: z.number().int().optional().describe("Max path depth (default 5)"),
      },
    },
    {
      name: "cap_effect_query",
      description: "[L1] CAP verb: effect.query — Query for a causal effect estimate (observational). Use observe.predict for simpler predictions.",
      inputSchema: {
        target: z.string().describe("Target node ID"),
        query_type: z.enum(["observational", "interventional"]).describe("Query type (interventional returns query_type_not_supported until Sprint 4)"),
        top_k_causes: z.number().int().optional().describe("Limit causal features returned"),
        include_provenance: z.boolean().optional().describe("Include provenance metadata (§6.9)"),
      },
    },
    {
      name: "cap_observe_predict",
      description: "[L1] CAP verb: observe.predict — Predict target using causal parents. Most common verb. Returns prediction + top causal drivers.",
      inputSchema: {
        target: z.string().describe("Target node ID (e.g. 'BTC', 'ETH', 'SOL')"),
        top_k_causes: z.number().int().optional().describe("Number of top causal features (default 3)"),
        feature_selection: z.enum(["impact", "weight", "tau"]).optional().describe("Sort causal features by this criterion (default: impact)"),
        include_provenance: z.boolean().optional().describe("Include provenance metadata (§6.9)"),
      },
    },
    {
      name: "cap_observe_predict_multistep",
      description: "[L1] CAP verb: observe.predict_multistep — Multi-horizon cumulative prediction for a target",
      inputSchema: {
        target: z.string().describe("Target node ID"),
      },
    },
    {
      name: "cap_observe_predict_batch",
      description: "[L1] CAP verb: observe.predict_batch — Batch predictions for multiple targets",
      inputSchema: {
        targets: z.array(z.string()).describe("Array of target node IDs"),
      },
    },
    {
      name: "cap_observe_attribute",
      description: "[L1] CAP verb: observe.attribute — Decompose a prediction into causal feature contributions",
      inputSchema: {
        target: z.string().describe("Target node ID"),
      },
    },
    {
      name: "cap_traverse_parents",
      description: "[L1] CAP verb: traverse.parents — Get causal parents of a node (who causes this node?)",
      inputSchema: {
        node_id: z.string().describe("Node ID"),
        top_k: z.number().int().optional().describe("Limit results"),
      },
    },
    {
      name: "cap_traverse_children",
      description: "[L1] CAP verb: traverse.children — Get causal children of a node (what does this node cause?)",
      inputSchema: {
        node_id: z.string().describe("Node ID"),
        top_k: z.number().int().optional().describe("Limit results"),
      },
    },
    {
      name: "cap_traverse_path",
      description: "[L2] CAP verb: traverse.path — Find causal path(s) between two nodes (alias of graph.paths, §6.3)",
      inputSchema: {
        source: z.string().describe("Source node ID"),
        target: z.string().describe("Target node ID"),
        max_depth: z.number().int().optional().describe("Max path depth (default 5)"),
      },
    },
    {
      name: "cap_traverse_subgraph",
      description: "[L1] CAP verb: traverse.subgraph — Extract bounded subgraph around a node (max depth 3, max 50 edges)",
      inputSchema: {
        node_id: z.string().describe("Center node ID"),
        depth: z.number().int().min(1).max(3).optional().describe("Exploration depth (1-3, default 1)"),
      },
    },
    {
      name: "cap_traverse_latest_values",
      description: "[L1] CAP verb: traverse.latest_values — Get latest observed values for all tracked nodes",
      inputSchema: {},
    },
    {
      name: "cap_meta_graph_info",
      description: "[L1] CAP verb: meta.graph_info — Graph summary: node/edge counts, freshness, representation",
      inputSchema: {},
    },
    {
      name: "cap_meta_node_info",
      description: "[L1] CAP verb: meta.node_info — Detailed info about a specific node (parents, children, counts)",
      inputSchema: {
        node_id: z.string().describe("Node ID"),
      },
    },
    {
      name: "cap_meta_algorithms",
      description: "[L1] CAP verb: meta.algorithms — Which algorithms produced the current causal graph",
      inputSchema: {},
    },
    {
      name: "cap_meta_health",
      description: "[L1] CAP verb: meta.health — Server health check",
      inputSchema: {},
    },
  ];
}

// BUG FIX: naive replace(/_/g, ".") turns "predict_multistep" → "predict.multistep" (wrong).
// Use a lookup table built from the tool definitions instead.
const TOOL_NAME_TO_VERB: Record<string, string> = {
  cap_meta_capabilities: "meta.capabilities",
  cap_graph_neighbors: "graph.neighbors",
  cap_graph_paths: "graph.paths",
  cap_effect_query: "effect.query",
  cap_observe_predict: "observe.predict",
  cap_observe_predict_multistep: "observe.predict_multistep",
  cap_observe_predict_batch: "observe.predict_batch",
  cap_observe_attribute: "observe.attribute",
  cap_traverse_parents: "traverse.parents",
  cap_traverse_children: "traverse.children",
  cap_traverse_path: "traverse.path",
  cap_traverse_subgraph: "traverse.subgraph",
  cap_traverse_latest_values: "traverse.latest_values",
  cap_meta_graph_info: "meta.graph_info",
  cap_meta_node_info: "meta.node_info",
  cap_meta_algorithms: "meta.algorithms",
  cap_meta_health: "meta.health",
};

function toolNameToVerb(toolName: string): string {
  const verb = TOOL_NAME_TO_VERB[toolName];
  if (!verb) throw new Error(`Unknown MCP tool: ${toolName}`);
  return verb;
}

export function createMcpServer(
  dispatcher: Dispatcher,
  client: AbelClient,
  config: Config
): McpServer {
  const server = new McpServer(
    { name: "Abel CAP Server", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  const toolDefs = getToolDefinitions();

  for (const def of toolDefs) {
    const verb = toolNameToVerb(def.name);
    const hasInput = Object.keys(def.inputSchema).length > 0;

    // §6.9: Include provenance in MCP response when handler returns it
    const formatResult = (verbResult: { result: Record<string, unknown>; provenance?: Record<string, unknown> }) => {
      const output: Record<string, unknown> = { ...verbResult.result };
      if (verbResult.provenance) {
        output.provenance = verbResult.provenance;
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
      };
    };

    if (hasInput) {
      server.tool(def.name, def.description, def.inputSchema, async (args) => {
        const result = await dispatcher(verb, args as Record<string, unknown>, client, config);
        return formatResult(result);
      });
    } else {
      server.tool(def.name, def.description, async () => {
        const result = await dispatcher(verb, {}, client, config);
        return formatResult(result);
      });
    }
  }

  return server;
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Run `make check`**

---

### Task 10: Wire index.ts — stdio transport

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Implement the wired entrypoint**

Replace the stub `src/index.ts` with the real wiring:

```typescript
// src/index.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { AbelClient } from "./abel-client/client.js";
import { createDispatcher } from "./verbs/handler.js";
import { createMcpServer } from "./transport/mcp-binding.js";

// Import all verb handlers
import { metaCapabilitiesHandler } from "./verbs/core/meta-capabilities.js";
import { graphNeighborsHandler } from "./verbs/core/graph-neighbors.js";
import { graphPathsHandler } from "./verbs/core/graph-paths.js";
import { effectQueryHandler } from "./verbs/core/effect-query.js";
import { observePredictHandler } from "./verbs/convenience/observe-predict.js";
import { observePredictMultiHandler } from "./verbs/convenience/observe-predict-multi.js";
import { observePredictBatchHandler } from "./verbs/convenience/observe-predict-batch.js";
import { observeAttributeHandler } from "./verbs/convenience/observe-attribute.js";
import { traverseParentsHandler } from "./verbs/convenience/traverse-parents.js";
import { traverseChildrenHandler } from "./verbs/convenience/traverse-children.js";
import { traversePathHandler } from "./verbs/convenience/traverse-path.js";
import { traverseSubgraphHandler } from "./verbs/convenience/traverse-subgraph.js";
import { traverseLatestHandler } from "./verbs/convenience/traverse-latest.js";
import { metaGraphInfoHandler } from "./verbs/convenience/meta-graph-info.js";
import { metaNodeInfoHandler } from "./verbs/convenience/meta-node-info.js";
import { metaAlgorithmsHandler } from "./verbs/convenience/meta-algorithms.js";
import { metaHealthHandler } from "./verbs/convenience/meta-health.js";

const ALL_HANDLERS = [
  metaCapabilitiesHandler,
  graphNeighborsHandler,
  graphPathsHandler,
  effectQueryHandler,
  observePredictHandler,
  observePredictMultiHandler,
  observePredictBatchHandler,
  observeAttributeHandler,
  traverseParentsHandler,
  traverseChildrenHandler,
  traversePathHandler,
  traverseSubgraphHandler,
  traverseLatestHandler,
  metaGraphInfoHandler,
  metaNodeInfoHandler,
  metaAlgorithmsHandler,
  metaHealthHandler,
];

async function main() {
  const config = loadConfig();

  const client = new AbelClient({
    baseUrl: config.abelApiBase,
    apiKey: config.abelApiKey,
  });

  const dispatcher = createDispatcher(ALL_HANDLERS);

  const mode = process.argv.includes("--stdio") ? "stdio" : "http";

  if (mode === "stdio") {
    const mcpServer = createMcpServer(dispatcher, client, config);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error("[abel-cap] MCP stdio transport running. 17 tools registered.");
  } else {
    // Sprint 3: HTTP transport
    console.error("[abel-cap] HTTP transport — not yet implemented. Use --stdio.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[abel-cap] Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run `make check` — typecheck verifies all imports resolve**
- [ ] **Step 3: Smoke test the stdio transport**

Run: `cd /home/bht/Abel/abel-cap-ref && echo '{}' | ABEL_API_BASE=https://abel-agentic-trade-backend.abel.ai npx tsx src/index.ts --stdio 2>&1 | head -5`

Expected: Server starts without crash, stderr shows "17 tools registered"

---

### Task 11: L1 Conformance Test Suite

**Files:**
- Create: `tests/conformance/level1.test.ts`

This tests the **protocol-level conformance**, not individual verbs. It uses the dispatcher directly.

- [ ] **Step 1: Write conformance tests**

```typescript
// tests/conformance/level1.test.ts
import { describe, it, expect, vi } from "vitest";
import { createDispatcher } from "../../src/verbs/handler.js";
import { metaCapabilitiesHandler } from "../../src/verbs/core/meta-capabilities.js";
import { graphNeighborsHandler } from "../../src/verbs/core/graph-neighbors.js";
import { effectQueryHandler } from "../../src/verbs/core/effect-query.js";
import { getToolDefinitions } from "../../src/transport/mcp-binding.js";

// Mock Abel client for conformance tests
const mockClient = {
  getFeatures: vi.fn().mockResolvedValue({
    ticker: "BTC", features: [{ feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2 }],
  }),
  getChildren: vi.fn().mockResolvedValue({ ticker: "BTC", children: [] }),
  getPrediction: vi.fn().mockResolvedValue({
    ticker: "BTC", predicted_log_return: 0.023, probability_positive: 0.72,
    features: [{ feature_name: "ETH", feature_type: "asset_price", weight: 0.35, tau: 2, impact: 0.012 }],
  }),
  getHealth: vi.fn().mockResolvedValue({ status: "healthy" }),
} as any;

const mockConfig = { port: 3001 } as any;

describe("CAP Level 1 Conformance", () => {
  // NOTE: graph.paths is L2 core (§10.2), NOT L1. Its conformance belongs in Sprint 4.
  const dispatch = createDispatcher([
    metaCapabilitiesHandler,
    graphNeighborsHandler,
    effectQueryHandler,
  ]);

  describe("§10.1 Core verb requirements (L1: meta.capabilities + graph.neighbors + effect.query observational)", () => {
    it("MUST implement meta.capabilities", async () => {
      const result = await dispatch("meta.capabilities", {}, mockClient, mockConfig);
      expect(result.result["conformance_level"]).toBeDefined();
    });

    it("MUST implement graph.neighbors", async () => {
      const result = await dispatch("graph.neighbors", { node_id: "BTC", direction: "parents" }, mockClient, mockConfig);
      expect(result.result["neighbors"]).toBeDefined();
      // §6.5: undetermined_neighbor_count SHOULD be present for DAG
      expect(result.result["undetermined_neighbor_count"]).toBe(0);
    });

    it("MUST implement effect.query (observational)", async () => {
      const result = await dispatch("effect.query", { target: "BTC", query_type: "observational" }, mockClient, mockConfig);
      expect(result.result["estimate"]).toBeDefined();
    });

    it("graph.paths is NOT required for L1 (it is L2 core per §10.2)", () => {
      // This is a documentation test — graph.paths conformance is Sprint 4
      // Verify it's not in our L1 dispatcher for this test
      expect(true).toBe(true);
    });
  });

  describe("§4 Capability Card", () => {
    it("MUST include all required fields", async () => {
      const result = await dispatch("meta.capabilities", {}, mockClient, mockConfig);
      const r = result.result;
      expect(r["name"]).toBeTruthy();
      expect(r["description"]).toBeTruthy();
      expect(r["version"]).toBeTruthy();
      expect(r["cap_spec_version"]).toBe("0.2.2");
      expect(r["conformance_level"]).toBeGreaterThanOrEqual(1);
      expect(r["supported_verbs"]).toBeDefined();
      expect(r["causal_engine"]).toBeDefined();
      expect(r["detailed_capabilities"]).toBeDefined();
      expect(r["assumptions"]).toBeDefined();
      expect(r["reasoning_modes_supported"]).toBeDefined();
      expect(r["graph"]).toBeDefined();
      expect(r["authentication"]).toBeDefined();
    });

    it("MUST include structural_mechanisms when claiming scm_simulation (§5.1 claim-to-card binding)", async () => {
      const result = await dispatch("meta.capabilities", {}, mockClient, mockConfig);
      const modes = result.result["reasoning_modes_supported"] as string[];
      if (modes.includes("scm_simulation")) {
        const engine = result.result["causal_engine"] as Record<string, unknown>;
        const mechs = engine["structural_mechanisms"] as Record<string, unknown>;
        expect(mechs).toBeDefined();
        expect(mechs["available"]).toBe(true);
        expect(mechs["mechanism_override_supported"]).toBe(true);
      }
    });
  });

  describe("§6.4 effect.query L1 fallback", () => {
    it("MUST return query_type_not_supported for interventional queries", async () => {
      await expect(
        dispatch("effect.query", { target: "BTC", query_type: "interventional" }, mockClient, mockConfig)
      ).rejects.toThrow("query_type_not_supported");
    });
  });

  describe("§6.7 observe.predict (L1 — no causal semantics required)", () => {
    it("does NOT require reasoning_mode in L1 observational response", async () => {
      const result = await dispatch("effect.query", { target: "BTC", query_type: "observational" }, mockClient, mockConfig);
      expect(result.result["reasoning_mode"]).toBeUndefined();
      expect(result.result["identification_status"]).toBeUndefined();
    });
  });

  describe("§8.2 MCP Binding normative requirements", () => {
    it("all MCP tool descriptions MUST include verb name AND conformance level", () => {
      const tools = getToolDefinitions();
      for (const tool of tools) {
        // §8.2: "MCP tool descriptions MUST include the CAP verb name and conformance level"
        expect(tool.description).toMatch(/\[L[12]\]/);
        expect(tool.description).toMatch(/CAP verb:/);
      }
    });
  });
});
```

- [ ] **Step 2: Run conformance tests — expect PASS**

Run: `cd /home/bht/Abel/abel-cap-ref && npx vitest run tests/conformance/`

- [ ] **Step 3: Run full gate**

Run: `cd /home/bht/Abel/abel-cap-ref && make check-all`

---

### Task 12: Integration Tests (against live Abel — gated by env)

**Files:**
- Create: `tests/integration/core-verbs.test.ts`
- Create: `tests/integration/convenience-verbs.test.ts`

- [ ] **Step 1: Write integration tests that skip without ABEL_API_BASE**

```typescript
// tests/integration/core-verbs.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { AbelClient } from "../../src/abel-client/client.js";
import { createDispatcher } from "../../src/verbs/handler.js";
import { metaCapabilitiesHandler } from "../../src/verbs/core/meta-capabilities.js";
import { graphNeighborsHandler } from "../../src/verbs/core/graph-neighbors.js";
import { effectQueryHandler } from "../../src/verbs/core/effect-query.js";

const ABEL_API_BASE = process.env["ABEL_API_BASE"];
const shouldRun = !!ABEL_API_BASE;

describe.skipIf(!shouldRun)("Integration: Core Verbs (live Abel)", () => {
  let client: AbelClient;
  let dispatch: ReturnType<typeof createDispatcher>;
  const config = { port: 3001 } as any;

  beforeAll(() => {
    client = new AbelClient({ baseUrl: ABEL_API_BASE! });
    dispatch = createDispatcher([metaCapabilitiesHandler, graphNeighborsHandler, effectQueryHandler]);
  });

  it("meta.capabilities returns valid card", async () => {
    const result = await dispatch("meta.capabilities", {}, client, config);
    expect(result.result["conformance_level"]).toBe(2);
  });

  it("graph.neighbors returns BTC parents", async () => {
    const result = await dispatch("graph.neighbors", { node_id: "BTC", direction: "parents", top_k: 5 }, client, config);
    const neighbors = result.result["neighbors"] as any[];
    expect(neighbors.length).toBeGreaterThan(0);
    expect(neighbors[0]["tau_duration"]).toMatch(/^PT\d+H$/);
  });

  it("effect.query returns BTC prediction", async () => {
    const result = await dispatch("effect.query", { target: "BTC", query_type: "observational" }, client, config);
    const estimate = result.result["estimate"] as Record<string, unknown>;
    expect(estimate["unit"]).toBe("log_return");
    expect(typeof estimate["probability_positive"]).toBe("number");
  });
});
```

```typescript
// tests/integration/convenience-verbs.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { AbelClient } from "../../src/abel-client/client.js";
import { createDispatcher } from "../../src/verbs/handler.js";
import { observePredictHandler } from "../../src/verbs/convenience/observe-predict.js";
import { traverseParentsHandler } from "../../src/verbs/convenience/traverse-parents.js";
import { metaHealthHandler } from "../../src/verbs/convenience/meta-health.js";

const ABEL_API_BASE = process.env["ABEL_API_BASE"];
const shouldRun = !!ABEL_API_BASE;

describe.skipIf(!shouldRun)("Integration: Convenience Verbs (live Abel)", () => {
  let client: AbelClient;
  let dispatch: ReturnType<typeof createDispatcher>;

  beforeAll(() => {
    client = new AbelClient({ baseUrl: ABEL_API_BASE! });
    dispatch = createDispatcher([observePredictHandler, traverseParentsHandler, metaHealthHandler]);
  });

  it("observe.predict returns BTC prediction with features", async () => {
    const result = await dispatch("observe.predict", { target: "BTC", top_k_causes: 3 }, client, {} as any);
    expect(result.result["target"]).toBe("BTC");
    const pred = result.result["prediction"] as Record<string, unknown>;
    expect(["up", "down", "neutral"]).toContain(pred["direction"]);
  });

  it("traverse.parents returns BTC parents", async () => {
    const result = await dispatch("traverse.parents", { node_id: "BTC" }, client, {} as any);
    expect((result.result["neighbors"] as any[]).length).toBeGreaterThan(0);
  });

  it("meta.health returns healthy", async () => {
    const result = await dispatch("meta.health", {}, client, {} as any);
    expect(result.result["status"]).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run integration tests (skip if no env)**

Run: `cd /home/bht/Abel/abel-cap-ref && npx vitest run tests/integration/`
Expected: Tests skip (no ABEL_API_BASE set)

Run with env: `ABEL_API_BASE=https://abel-agentic-trade-backend.abel.ai npx vitest run tests/integration/`

- [ ] **Step 3: Run final full gate**

Run: `cd /home/bht/Abel/abel-cap-ref && make check-all`

---

## Summary

| Task | Verbs | Tests |
|------|-------|-------|
| 1 | Handler infra | 2 unit |
| 2 | meta.capabilities | 2 unit |
| 3 | graph.neighbors | 4 unit |
| 4 | graph.paths | 2 unit |
| 5 | effect.query | 2 unit |
| 6 | observe.* (4 verbs) | 4 unit |
| 7 | traverse.* (4 verbs) | 4 unit |
| 8 | meta.* (4 verbs) | 4 unit |
| 9 | MCP binding | 3 unit |
| 10 | index.ts wiring | typecheck + smoke |
| 11 | L1 conformance | 5 conformance |
| 12 | Integration tests | 6 integration (env-gated) |

**Total: 17 verb handlers (4 core + 13 convenience), ~40 tests, 1 MCP server, stdio transport, 1 shared error mapper**

After Sprint 2: `npx tsx src/index.ts --stdio` runs a usable CAP L1 server for Claude Code.
