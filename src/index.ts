/**
 * Abel CAP Server — Entrypoint
 *
 * Dual transport: --stdio for MCP (local) or HTTP (remote).
 * Sprint 2: MCP stdio transport with all 17 verb handlers.
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
    console.error(
      `[abel-cap] MCP stdio transport running. ${ALL_HANDLERS.length} tools registered.`
    );
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
