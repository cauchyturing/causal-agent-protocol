// src/transport/shared-types.ts

/**
 * Result from a CAP verb execution.
 */
export interface VerbResult {
  result: Record<string, unknown>;
  provenance?: Record<string, unknown>;
}

/**
 * A dispatcher with backend details already curried.
 * Used by MCP and HTTP transports — they don't need to know about the backend.
 */
export type BoundDispatcher = (
  verb: string,
  params: Record<string, unknown>
) => Promise<VerbResult>;
