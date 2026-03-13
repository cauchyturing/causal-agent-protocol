/**
 * CAP Request/Response Envelope — v0.2.2 §7
 *
 * All CAP messages are wrapped in these envelopes.
 * Transport layer constructs requests; verb handlers return results
 * that get wrapped into response envelopes here.
 */

import { z } from "zod";
import { CAPError } from "./errors.js";

export const CAP_VERSION = "0.2" as const;

// ── Request Envelope ──────────────────────────────────────────

export const RequestOptionsSchema = z
  .object({
    timeout_ms: z.number().int().positive().optional(),
    response_detail: z.enum(["summary", "full", "raw"]).optional(),
  })
  .strict()
  .optional();

export const RequestEnvelopeSchema = z.object({
  cap_version: z.literal("0.2"),
  request_id: z.string().uuid(),
  verb: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
  options: RequestOptionsSchema,
});

export type RequestEnvelope = z.infer<typeof RequestEnvelopeSchema>;

// ── Response Envelope ─────────────────────────────────────────

export interface Pagination {
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

export interface ResponseEnvelope {
  cap_version: typeof CAP_VERSION;
  request_id: string;
  verb: string;
  status: "success" | "error" | "partial";
  result?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    suggestion?: string;
    details?: Record<string, unknown>;
  };
  pagination?: Pagination;
}

export function buildSuccessResponse(
  requestId: string,
  verb: string,
  result: Record<string, unknown>,
  provenance?: Record<string, unknown>,
  pagination?: Pagination
): ResponseEnvelope {
  return {
    cap_version: CAP_VERSION,
    request_id: requestId,
    verb,
    status: "success",
    result,
    ...(provenance && { provenance }),
    ...(pagination && { pagination }),
  };
}

export function buildErrorResponse(
  requestId: string,
  verb: string,
  error: CAPError
): ResponseEnvelope {
  return {
    cap_version: CAP_VERSION,
    request_id: requestId,
    verb,
    status: "error",
    error: error.toResponseError(),
  };
}
