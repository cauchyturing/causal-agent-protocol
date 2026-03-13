// src/transport/shared-types.ts
import type { VerbResult } from "../verbs/handler.js";

/**
 * A dispatcher with client + config already curried.
 * Used by HTTP and MCP transports so they don't need to know about AbelClient.
 */
export type BoundDispatcher = (
  verb: string,
  params: Record<string, unknown>
) => Promise<VerbResult>;
