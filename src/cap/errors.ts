/**
 * CAP Error Codes — v0.2.2 §7.3
 *
 * Every error code maps to an HTTP status and a human-readable meaning.
 * Verb handlers throw CAPError; transport layer converts to response envelope.
 */

export const CAP_ERROR_CODES = {
  node_not_found: { http: 404, message: "Node does not exist in graph" },
  verb_not_supported: {
    http: 501,
    message: "Server does not support this verb at this conformance level",
  },
  insufficient_tier: {
    http: 403,
    message: "Access tier too low for requested verb or detail level",
  },
  graph_stale: {
    http: 503,
    message: "Graph not updated within expected frequency",
  },
  computation_timeout: {
    http: 504,
    message: "Causal computation exceeded timeout",
  },
  invalid_intervention: {
    http: 422,
    message: "Intervention parameters invalid",
  },
  path_not_found: {
    http: 404,
    message: "No causal path exists between nodes",
  },
  rate_limited: { http: 429, message: "Rate limit exceeded" },
  subgraph_too_large: {
    http: 413,
    message: "Subgraph request exceeds max response size",
  },
  query_type_not_supported: {
    http: 400,
    message: "Server cannot perform the requested query_type",
  },
  insufficient_mechanism_coverage: {
    http: 422,
    message:
      "Target nodes require causal path nodes that lack executable structural mechanisms",
  },
  internal_error: {
    http: 500,
    message: "An unexpected internal server error occurred",
  },
} as const;

export type CAPErrorCode = keyof typeof CAP_ERROR_CODES;

export class CAPError extends Error {
  readonly code: CAPErrorCode;
  readonly httpStatus: number;
  readonly suggestion?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: CAPErrorCode,
    opts?: { suggestion?: string; details?: Record<string, unknown> }
  ) {
    const def = CAP_ERROR_CODES[code];
    super(def.message);
    this.name = "CAPError";
    this.code = code;
    this.httpStatus = def.http;
    this.suggestion = opts?.suggestion;
    this.details = opts?.details;
  }

  toResponseError() {
    return {
      code: this.code,
      message: this.message,
      ...(this.suggestion && { suggestion: this.suggestion }),
      ...(this.details && { details: this.details }),
    };
  }
}
