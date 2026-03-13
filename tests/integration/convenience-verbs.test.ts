import { describe, it, expect, beforeAll } from "vitest";
import { AbelClient } from "../../src/abel-client/client.js";
import { createDispatcher } from "../../src/verbs/handler.js";
import { observePredictHandler } from "../../src/verbs/convenience/observe-predict.js";
import { traverseParentsHandler } from "../../src/verbs/convenience/traverse-parents.js";
import { metaHealthHandler } from "../../src/verbs/convenience/meta-health.js";
import type { Config } from "../../src/config.js";

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
    const result = await dispatch("observe.predict", { target: "BTC", top_k_causes: 3 }, client, {} as unknown as Config);
    expect(result.result["target"]).toBe("BTC");
    const pred = result.result["prediction"] as Record<string, unknown>;
    expect(["up", "down", "neutral"]).toContain(pred["direction"]);
  });

  it("traverse.parents returns BTC parents", async () => {
    const result = await dispatch("traverse.parents", { node_id: "BTC" }, client, {} as unknown as Config);
    expect((result.result["neighbors"] as Array<unknown>).length).toBeGreaterThan(0);
  });

  it("meta.health returns healthy", async () => {
    const result = await dispatch("meta.health", {}, client, {} as unknown as Config);
    expect(result.result["status"]).toBeTruthy();
  });
});
