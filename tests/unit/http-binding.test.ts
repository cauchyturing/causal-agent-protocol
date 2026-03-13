// tests/unit/http-binding.test.ts
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createHttpApp } from "../../src/transport/http-binding.js";
import type { BoundDispatcher } from "../../src/transport/shared-types.js";
import type { Config } from "../../src/config.js";

const mockDispatcher: BoundDispatcher = vi.fn().mockResolvedValue({
  result: { target: "BTC", prediction: 0.023 },
});

const mockConfig = {
  port: 3001,
  capEndpoint: "https://cap.abel.ai",
  capApiKey: "",
  accessTier: "standard",
  rateLimitPublic: 100,
  rateLimitStandard: 1000,
  rateLimitEnterprise: 10000,
  maxSubgraphEdges: 50,
} as unknown as Config;

describe("CAP HTTP Binding", () => {
  const app = createHttpApp(mockDispatcher, mockConfig);

  describe("GET /.well-known/cap.json", () => {
    it("returns Capability Card with correct content-type", async () => {
      const res = await request(app).get("/.well-known/cap.json");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.body["cap_spec_version"]).toBe("0.2.2");
      expect(res.body["name"]).toBe("Abel Social Physical Engine");
    });
  });

  describe("POST /v1/:category/:name (verb dispatch)", () => {
    it("dispatches a valid request envelope", async () => {
      const res = await request(app)
        .post("/v1/observe/predict")
        .set("Content-Type", "application/json")
        .set("X-CAP-Key", "test-key")
        .send({
          cap_version: "0.2",
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          verb: "observe.predict",
          params: { target: "BTC" },
        });
      expect(res.status).toBe(200);
      expect(res.body["cap_version"]).toBe("0.2");
      expect(res.body["status"]).toBe("success");
      expect(res.body["verb"]).toBe("observe.predict");
      expect(res.body["result"]).toBeDefined();
    });

    it("returns error for missing cap_version", async () => {
      const res = await request(app)
        .post("/v1/observe/predict")
        .set("X-CAP-Key", "test-key")
        .send({
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          verb: "observe.predict",
          params: { target: "BTC" },
        });
      expect(res.status).toBe(400);
      expect(res.body["status"]).toBe("error");
    });

    it("verifies verb in path matches verb in envelope", async () => {
      const res = await request(app)
        .post("/v1/observe/predict")
        .set("X-CAP-Key", "test-key")
        .send({
          cap_version: "0.2",
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          verb: "graph.neighbors",
          params: { node_id: "BTC" },
        });
      expect(res.status).toBe(400);
      expect(res.body["error"]["code"]).toMatch(/mismatch|invalid|query_type_not_supported/i);
    });

    it("returns CAP error envelope for verb_not_supported", async () => {
      const failDispatcher: BoundDispatcher = vi.fn().mockRejectedValue(
        new (await import("../../src/cap/errors.js")).CAPError("verb_not_supported")
      );
      const failApp = createHttpApp(failDispatcher, mockConfig);
      const res = await request(failApp)
        .post("/v1/effect/query")
        .set("X-CAP-Key", "test-key")
        .send({
          cap_version: "0.2",
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          verb: "effect.query",
          params: { target: "BTC", query_type: "observational" },
        });
      expect(res.status).toBe(501);
      expect(res.body["status"]).toBe("error");
      expect(res.body["error"]["code"]).toBe("verb_not_supported");
    });
  });

  describe("Tier enforcement via HTTP", () => {
    it("rejects public-tier request for graph.neighbors (not in public verbs)", async () => {
      const res = await request(app)
        .post("/v1/graph/neighbors")
        .send({
          cap_version: "0.2",
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          verb: "graph.neighbors",
          params: { node_id: "BTC", direction: "parents" },
        });
      expect(res.status).toBe(403);
      expect(res.body["error"]["code"]).toBe("insufficient_tier");
    });

    it("accepts Authorization: Bearer header as alternative to X-CAP-Key", async () => {
      const res = await request(app)
        .post("/v1/observe/predict")
        .set("Authorization", "Bearer test-key")
        .send({
          cap_version: "0.2",
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          verb: "observe.predict",
          params: { target: "BTC" },
        });
      expect(res.status).toBe(200);
      expect(res.body["status"]).toBe("success");
    });
  });
});
