import { describe, it, expect, beforeAll } from "vitest";
import { AbelClient } from "../../src/abel-client/client.js";
import { createDispatcher } from "../../src/verbs/handler.js";
import { metaCapabilitiesHandler } from "../../src/verbs/core/meta-capabilities.js";
import { graphNeighborsHandler } from "../../src/verbs/core/graph-neighbors.js";
import { effectQueryHandler } from "../../src/verbs/core/effect-query.js";
import type { Config } from "../../src/config.js";

const ABEL_API_BASE = process.env["ABEL_API_BASE"];
const shouldRun = !!ABEL_API_BASE;

describe.skipIf(!shouldRun)("Integration: Core Verbs (live Abel)", () => {
  let client: AbelClient;
  let dispatch: ReturnType<typeof createDispatcher>;
  const config = { port: 3001 } as unknown as Config;

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
    const neighbors = result.result["neighbors"] as Array<Record<string, unknown>>;
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
