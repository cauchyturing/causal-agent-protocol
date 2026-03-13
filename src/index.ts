/**
 * CAP MCP Bridge — Entrypoint
 *
 * Exposes any CAP v0.2.2 HTTP endpoint as MCP tools.
 * Dual transport: --stdio for local MCP or HTTP for remote MCP + CAP HTTP binding.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createMcpServer, getToolDefinitions } from "./transport/mcp-binding.js";
import type { BoundDispatcher } from "./transport/shared-types.js";

/**
 * Create a BoundDispatcher that proxies to a CAP HTTP endpoint.
 * Translates MCP tool calls → CAP HTTP POST /v1/{category}/{name}.
 */
function createCapProxy(capEndpoint: string, apiKey?: string): BoundDispatcher {
  return async (verb: string, params: Record<string, unknown>) => {
    const [category, name] = verb.split(".");
    const url = `${capEndpoint}/v1/${category}/${name}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["X-CAP-Key"] = apiKey;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        cap_version: "0.2",
        request_id: crypto.randomUUID(),
        verb,
        params,
      }),
    });

    const envelope = (await response.json()) as Record<string, unknown>;

    if (envelope["status"] === "error") {
      const error = envelope["error"] as Record<string, unknown>;
      throw new Error(`CAP error [${error["code"]}]: ${error["message"]}`);
    }

    return {
      result: (envelope["result"] as Record<string, unknown>) ?? {},
      provenance: envelope["provenance"] as Record<string, unknown> | undefined,
    };
  };
}

async function main() {
  const config = loadConfig();
  const dispatcher = createCapProxy(config.capEndpoint, config.capApiKey);

  const mode = process.argv.includes("--stdio") ? "stdio" : "http";

  if (mode === "stdio") {
    const mcpServer = createMcpServer(dispatcher);
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error(`[cap-bridge] MCP stdio transport running. ${getToolDefinitions().length} tools registered.`);
    console.error(`[cap-bridge] Proxying to CAP endpoint: ${config.capEndpoint}`);
  } else {
    const { createHttpApp } = await import("./transport/http-binding.js");
    const { serveA2ARoute } = await import("./transport/a2a-card.js");
    const { mountMcpHttp } = await import("./transport/mcp-http-transport.js");

    const app = createHttpApp(dispatcher, config);
    serveA2ARoute(app, config);
    mountMcpHttp(app, dispatcher);

    const baseUrl = config.publicUrl ?? `http://localhost:${config.port}`;
    const server = app.listen(config.port, () => {
      console.error(`[cap-bridge] HTTP server on port ${config.port}. Proxying to: ${config.capEndpoint}`);
      console.error(`[cap-bridge] Capability Card: ${baseUrl}/.well-known/cap.json`);
      console.error(`[cap-bridge] MCP Streamable HTTP: ${baseUrl}/mcp`);
    });

    const shutdown = () => {
      console.error("[cap-bridge] Draining connections...");
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}

main().catch((err) => {
  console.error("[cap-bridge] Fatal:", err);
  process.exit(1);
});
