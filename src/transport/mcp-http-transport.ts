// src/transport/mcp-http-transport.ts
//
// MCP Streamable HTTP Transport — mounts at /mcp on the existing Express app.
// Stateful per-session transport using StreamableHTTPServerTransport from MCP SDK.

import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { AbelClient } from "../abel-client/client.js";
import type { Config } from "../config.js";
import type { Dispatcher } from "../verbs/handler.js";
import { createMcpServer } from "./mcp-binding.js";

/**
 * Mount MCP Streamable HTTP at /mcp on an existing Express app.
 *
 * Each MCP session gets its own McpServer + Transport pair.
 * Sessions are created on initialize and cleaned up on DELETE or transport close.
 */
export function mountMcpHttp(
  app: Express,
  dispatcher: Dispatcher,
  client: AbelClient,
  config: Config
): void {
  /** Active session transports keyed by session ID (scoped to this mount). */
  const sessions = new Map<string, StreamableHTTPServerTransport>();
  // POST /mcp — JSON-RPC requests (initialize, tools/list, tools/call, etc.)
  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    // Existing session — forward to its transport
    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — must be an initialize request
    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string) => {
          sessions.set(id, transport);
        },
      });

      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) sessions.delete(id);
      };

      // Create a fresh McpServer for this session with all 18 CAP tools
      const mcpServer = createMcpServer(dispatcher, client, config);
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Invalid: no session and not an initialize, OR unknown session ID
    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID or not an initialize request",
      },
      id: null,
    });
  });

  // GET /mcp — SSE stream for server-to-client notifications
  app.get("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Invalid or missing session ID",
        },
        id: null,
      });
      return;
    }
    await sessions.get(sessionId)!.handleRequest(req, res);
  });

  // DELETE /mcp — session cleanup
  app.delete("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions.has(sessionId)) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Invalid or missing session ID",
        },
        id: null,
      });
      return;
    }
    await sessions.get(sessionId)!.handleRequest(req, res);
  });
}
