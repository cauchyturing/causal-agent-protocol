import { CAPError } from "../../cap/errors.js";

/**
 * Maps Abel API HTTP errors to CAP error codes.
 * Wraps every AbelClient call so verb handlers get CAPErrors.
 */
export function mapAbelError(err: unknown): never {
  if (err instanceof CAPError) throw err;

  const errObj = err as Record<string, unknown>;
  const responseObj = errObj?.["response"] as Record<string, unknown> | undefined;
  const status =
    (errObj?.["status"] as number | undefined) ??
    (responseObj?.["status"] as number | undefined);
  const message = (errObj?.["message"] as string | undefined) ?? "Unknown Abel API error";

  if (status === 404) {
    throw new CAPError("node_not_found", {
      suggestion: "Check the node_id exists in the causal graph via meta.graph_info",
    });
  }
  if (status === 408 || message.includes("timeout")) {
    throw new CAPError("computation_timeout", {
      suggestion: "Try a simpler query or increase timeout_ms",
    });
  }
  if (status === 429) {
    throw new CAPError("rate_limited", {
      suggestion: "Wait before retrying or upgrade access tier",
    });
  }
  if (status === 503) {
    throw new CAPError("graph_stale", {
      suggestion: "The causal graph is being updated. Retry in a few minutes.",
    });
  }

  // Re-throw unknown errors as-is
  throw err;
}

/** Wrap an async Abel client call with CAPError mapping */
export async function withErrorMapping<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    mapAbelError(err);
  }
}
