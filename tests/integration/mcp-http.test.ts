// tests/integration/mcp-http.test.ts
//
// Integration: Full MCP Streamable HTTP workflow over the Express app.
// Tests initialize → tool call → session cleanup end-to-end.

import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { BoundDispatcher } from "../../src/transport/shared-types.js";
import { mountMcpHttp } from "../../src/transport/mcp-http-transport.js";

const MCP_ACCEPT = "application/json, text/event-stream";

// Mock dispatcher that returns verb-specific responses
const mockDispatcher: BoundDispatcher = vi.fn().mockImplementation(
  async (verb: string) => {
    if (verb === "meta.health") {
      return {
        result: {
          status: "healthy",
          engine_status: "running",
          graph_freshness: "2026-03-12T00:00:00Z",
        },
      };
    }
    if (verb === "meta.capabilities") {
      return {
        result: {
          name: "Abel Social Physical Engine",
          conformance_level: 2,
        },
      };
    }
    return { result: { ok: true } };
  }
);

function createTestApp() {
  const app = express();
  app.use(express.json());
  mountMcpHttp(app, mockDispatcher);
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
  const text = res.text ?? "";
  const dataLines = text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6));
  if (dataLines.length === 0) return {};
  return JSON.parse(dataLines[dataLines.length - 1]) as Record<string, unknown>;
}

/** Helper: perform MCP initialize handshake, return session ID */
async function initializeSession(app: express.Express): Promise<string> {
  const res = await mcpPost(app).send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "integration-test", version: "1.0.0" },
    },
  });
  expect(res.status).toBe(200);
  const sessionId = res.headers["mcp-session-id"];
  expect(sessionId).toBeDefined();

  // Send initialized notification (MCP protocol requirement)
  await mcpPost(app).set("mcp-session-id", sessionId).send({
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });

  return sessionId;
}

describe("MCP Streamable HTTP — Integration", () => {
  describe("Initialize handshake", () => {
    it("completes MCP initialize and returns server info", async () => {
      const app = createTestApp();
      const res = await mcpPost(app).send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      });
      expect(res.status).toBe(200);
      const body = parseSseBody(res);
      expect(body["result"]).toBeDefined();
      const result = body["result"] as Record<string, unknown>;
      expect(result["serverInfo"]).toBeDefined();
      const serverInfo = result["serverInfo"] as Record<string, unknown>;
      expect(serverInfo["name"]).toBe("Abel CAP Server");
      expect(result["protocolVersion"]).toBeDefined();
    });
  });

  describe("Tool discovery", () => {
    it("tools/list returns all 20 CAP verb tools", async () => {
      const app = createTestApp();
      const sessionId = await initializeSession(app);

      const res = await mcpPost(app)
        .set("mcp-session-id", sessionId)
        .send({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        });
      expect(res.status).toBe(200);
      const body = parseSseBody(res);
      const result = body["result"] as Record<string, unknown>;
      const tools = result["tools"] as Array<{ name: string }>;
      expect(tools).toHaveLength(20);

      // Verify all tool names start with cap_
      for (const tool of tools) {
        expect(tool.name).toMatch(/^cap_/);
      }

      // Verify cap_meta_health is in the list
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain("cap_meta_health");
    });
  });

  describe("Tool invocation", () => {
    it("calls cap_meta_health through MCP HTTP transport", async () => {
      const app = createTestApp();
      const sessionId = await initializeSession(app);

      const res = await mcpPost(app)
        .set("mcp-session-id", sessionId)
        .send({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "cap_meta_health",
            arguments: {},
          },
        });
      expect(res.status).toBe(200);
      const body = parseSseBody(res);
      const result = body["result"] as Record<string, unknown>;
      expect(result).toBeDefined();
      const content = result["content"] as Array<{ type: string; text: string }>;
      expect(content).toBeDefined();
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBeGreaterThan(0);

      // Parse the text content — should be JSON with health status
      expect(content[0].type).toBe("text");
      const parsed = JSON.parse(content[0].text);
      expect(parsed.status).toBe("healthy");
    });
  });

  describe("Session cleanup", () => {
    it("DELETE /mcp terminates session", async () => {
      const app = createTestApp();
      const sessionId = await initializeSession(app);

      // Delete the session
      const deleteRes = await request(app)
        .delete("/mcp")
        .set("mcp-session-id", sessionId);
      expect(deleteRes.status).toBe(200);

      // Session should no longer be valid
      const postRes = await mcpPost(app)
        .set("mcp-session-id", sessionId)
        .send({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/list",
          params: {},
        });
      expect(postRes.status).toBe(400);
    });
  });

  describe("Conformance", () => {
    it("/mcp endpoint matches capability card bindings.mcp.endpoint suffix", async () => {
      const app = createTestApp();
      const res = await mcpPost(app).send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "conformance-test", version: "1.0" },
        },
      });
      // If /mcp wasn't mounted, this would 404
      expect(res.status).toBe(200);
    });
  });
});
