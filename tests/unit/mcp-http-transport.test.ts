// tests/unit/mcp-http-transport.test.ts
//
// Unit tests for mountMcpHttp() route registration and error handling.

import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { AbelClient } from "../../src/abel-client/client.js";
import type { Config } from "../../src/config.js";
import type { Dispatcher } from "../../src/verbs/handler.js";
import { mountMcpHttp } from "../../src/transport/mcp-http-transport.js";

const MCP_ACCEPT = "application/json, text/event-stream";

const mockDispatcher: Dispatcher = vi.fn().mockResolvedValue({
  result: { status: "healthy" },
});
const mockClient = {} as unknown as AbelClient;
const mockConfig = {
  port: 3001,
  accessTier: "standard",
  maxSubgraphEdges: 50,
} as unknown as Config;

function createTestApp() {
  const app = express();
  app.use(express.json());
  mountMcpHttp(app, mockDispatcher, mockClient, mockConfig);
  return app;
}

/** Helper: POST /mcp with correct MCP headers */
function mcpPost(app: express.Express) {
  return request(app)
    .post("/mcp")
    .set("Content-Type", "application/json")
    .set("Accept", MCP_ACCEPT);
}

/** Parse SSE "event: message\ndata: {...}" into JSON-RPC result */
function parseSseBody(res: request.Response): Record<string, unknown> {
  if (res.headers["content-type"]?.includes("application/json")) {
    return res.body as Record<string, unknown>;
  }
  // SSE format: one or more "event: message\ndata: <json>\n\n" blocks
  const text = res.text ?? "";
  const dataLines = text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6));
  if (dataLines.length === 0) return {};
  return JSON.parse(dataLines[dataLines.length - 1]) as Record<string, unknown>;
}

describe("mountMcpHttp — route registration", () => {
  const app = createTestApp();

  it("POST /mcp without session ID and non-initialize body returns 400", async () => {
    const res = await mcpPost(app).send({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe(-32000);
  });

  it("POST /mcp with unknown session ID returns 400", async () => {
    const res = await mcpPost(app)
      .set("mcp-session-id", "nonexistent-session-id")
      .send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      });
    expect(res.status).toBe(400);
  });

  it("GET /mcp without session ID returns 400", async () => {
    const res = await request(app).get("/mcp");
    expect(res.status).toBe(400);
  });

  it("DELETE /mcp without session ID returns 400", async () => {
    const res = await request(app).delete("/mcp");
    expect(res.status).toBe(400);
  });

  it("POST /mcp with initialize request returns 200 and Mcp-Session-Id header", async () => {
    const res = await mcpPost(app).send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers["mcp-session-id"]).toBeDefined();
    expect(typeof res.headers["mcp-session-id"]).toBe("string");
    expect(res.headers["mcp-session-id"].length).toBeGreaterThan(0);
  });
});

describe("mountMcpHttp — session lifecycle", () => {
  it("session persists across requests: initialize → tools/list", async () => {
    const app = createTestApp();

    // Step 1: Initialize
    const initRes = await mcpPost(app).send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });
    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers["mcp-session-id"];
    expect(sessionId).toBeDefined();

    // Step 1b: Send initialized notification (required by MCP protocol)
    await mcpPost(app).set("mcp-session-id", sessionId).send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    // Step 2: Use session to list tools
    const listRes = await mcpPost(app)
      .set("mcp-session-id", sessionId)
      .send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });
    expect(listRes.status).toBe(200);
    const body = parseSseBody(listRes);
    const result = body["result"] as Record<string, unknown>;
    expect(result).toBeDefined();
    expect(result["tools"]).toBeDefined();
    const tools = result["tools"] as Array<unknown>;
    expect(Array.isArray(tools)).toBe(true);
    // All 18 CAP verb tools should be registered
    expect(tools.length).toBe(18);
  });

  it("multiple independent sessions do not interfere", async () => {
    const app = createTestApp();

    // Create session A
    const resA = await mcpPost(app).send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "client-A", version: "1.0.0" },
      },
    });
    const sessionA = resA.headers["mcp-session-id"];

    // Create session B
    const resB = await mcpPost(app).send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "client-B", version: "1.0.0" },
      },
    });
    const sessionB = resB.headers["mcp-session-id"];

    expect(sessionA).toBeDefined();
    expect(sessionB).toBeDefined();
    expect(sessionA).not.toBe(sessionB);
  });
});
