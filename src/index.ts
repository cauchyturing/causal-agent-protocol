/**
 * Abel CAP Server — Entrypoint
 *
 * Dual transport: --stdio for MCP (local) or HTTP (remote).
 * Sprint 4: MCP stdio transport with all 18 verb handlers.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { AbelClient } from "./abel-client/client.js";
import { createDispatcher } from "./verbs/handler.js";
import { createMcpServer } from "./transport/mcp-binding.js";

// Core verbs
import { metaCapabilitiesHandler } from "./verbs/core/meta-capabilities.js";
import { graphNeighborsHandler } from "./verbs/core/graph-neighbors.js";
import { graphPathsHandler } from "./verbs/core/graph-paths.js";
import { effectQueryHandler } from "./verbs/core/effect-query.js";

// Convenience verbs — observe.*
import { observePredictHandler } from "./verbs/convenience/observe-predict.js";
import { observePredictMultiHandler } from "./verbs/convenience/observe-predict-multi.js";
import { observePredictBatchHandler } from "./verbs/convenience/observe-predict-batch.js";
import { observeAttributeHandler } from "./verbs/convenience/observe-attribute.js";

// Convenience verbs — traverse.*
import { traverseParentsHandler } from "./verbs/convenience/traverse-parents.js";
import { traverseChildrenHandler } from "./verbs/convenience/traverse-children.js";
import { traversePathHandler } from "./verbs/convenience/traverse-path.js";
import { traverseSubgraphHandler } from "./verbs/convenience/traverse-subgraph.js";
import { traverseLatestHandler } from "./verbs/convenience/traverse-latest.js";

// Convenience verbs — meta.*
import { metaGraphInfoHandler } from "./verbs/convenience/meta-graph-info.js";
import { metaNodeInfoHandler } from "./verbs/convenience/meta-node-info.js";
import { metaAlgorithmsHandler } from "./verbs/convenience/meta-algorithms.js";
import { metaHealthHandler } from "./verbs/convenience/meta-health.js";

// Convenience verbs — intervene.*
import { interveneDoHandler } from "./verbs/convenience/intervene-do.js";

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
  interveneDoHandler,
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
    console.error(
      `[abel-cap] MCP stdio transport running. ${ALL_HANDLERS.length} tools registered.`
    );
  } else {
    // HTTP transport — §8.1 CAP HTTP Binding
    const { createHttpApp } = await import("./transport/http-binding.js");
    const { serveA2ARoute } = await import("./transport/a2a-card.js");

    // Create bound dispatcher (client + config curried)
    const boundDispatcher = (verb: string, params: Record<string, unknown>) =>
      dispatcher(verb, params, client, config);

    const app = createHttpApp(boundDispatcher, config);

    // §8.3 A2A Agent Card
    serveA2ARoute(app, config);

    const baseUrl = config.publicUrl ?? `http://localhost:${config.port}`;
    const server = app.listen(config.port, () => {
      console.error(
        `[abel-cap] CAP HTTP server listening on port ${config.port}. ${ALL_HANDLERS.length} verbs registered.`
      );
      console.error(`[abel-cap] Capability Card: ${baseUrl}/.well-known/cap.json`);
      console.error(`[abel-cap] A2A Agent Card: ${baseUrl}/.well-known/agent-card.json`);
    });

    // Graceful shutdown — drain in-flight requests on SIGTERM
    const shutdown = () => {
      console.error("[abel-cap] Received shutdown signal, draining connections...");
      server.close(() => {
        console.error("[abel-cap] Server closed gracefully.");
        process.exit(0);
      });
      // Force exit after 10s if connections don't drain
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  }
}

main().catch((err) => {
  console.error("[abel-cap] Fatal:", err);
  process.exit(1);
});
