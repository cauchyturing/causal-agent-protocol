/**
 * Abel CAP Server — Entrypoint
 *
 * Dual transport: --stdio for MCP (local) or HTTP (remote).
 * Sprint 1: just validates config loads. Transports added in Sprint 2-3.
 */

import { loadConfig } from "./config.js";

const mode = process.argv.includes("--stdio") ? "stdio" : "http";

try {
  const config = loadConfig();
  console.error(
    `[abel-cap] Starting in ${mode} mode (port: ${config.port}, tier: ${config.accessTier})`
  );

  if (mode === "stdio") {
    // Sprint 2: MCP stdio transport
    console.error("[abel-cap] MCP stdio transport — not yet implemented");
  } else {
    // Sprint 3: HTTP transport
    console.error("[abel-cap] HTTP transport — not yet implemented");
  }
} catch (err) {
  console.error("[abel-cap] Failed to start:", err);
  process.exit(1);
}
