// src/security/obfuscation.ts
//
// §9.2 Progressive Disclosure — pure response transformation.
// Engine-agnostic: operates on generic CAP response shapes.

export type ResponseDetail = "summary" | "full" | "raw";

/**
 * Quantize a raw weight into a signed rank 1-5.
 * Preserves sign. Zero stays zero.
 *
 * Bucket boundaries (absolute value):
 *   0         → 0
 *   (0, 0.05] → 1
 *   (0.05, 0.15] → 2
 *   (0.15, 0.30] → 3
 *   (0.30, 0.50] → 4
 *   (0.50, ∞)    → 5
 */
export function quantizeWeight(weight: number): number {
  if (weight === 0) return 0;
  const abs = Math.abs(weight);
  const sign = weight > 0 ? 1 : -1;
  let rank: number;
  if (abs <= 0.05) rank = 1;
  else if (abs <= 0.15) rank = 2;
  else if (abs <= 0.30) rank = 3;
  else if (abs <= 0.50) rank = 4;
  else rank = 5;
  return sign * rank;
}

// Fields to strip at each level
const SUMMARY_STRIP = new Set([
  "weight", "tau", "tau_duration", "impact", "impact_fraction",
  "confidence_interval", "current_value", "current_change_percent",
  "interval_method",
]);

/**
 * Obfuscate a single neighbor/feature object per response_detail.
 */
export function obfuscateNeighbor(
  obj: Record<string, unknown>,
  detail: ResponseDetail
): Record<string, unknown> {
  if (detail === "raw") return { ...obj };

  const result = { ...obj };

  if (detail === "summary") {
    for (const key of SUMMARY_STRIP) {
      delete result[key];
    }
    return result;
  }

  // detail === "full" → quantize weight, keep everything else
  if (typeof result["weight"] === "number") {
    result["weight"] = quantizeWeight(result["weight"] as number);
  }
  return result;
}

/**
 * Obfuscate a full verb result object per response_detail.
 *
 * Recognizes these shaped keys:
 *   neighbors, causal_features — array of neighbor/feature objects
 *   estimate — contains confidence_interval, value, etc.
 *   paths — array of path arrays (removed at summary)
 *   edges — array of edge objects in subgraph responses
 */
export function obfuscateResponse(
  response: Record<string, unknown>,
  detail: ResponseDetail
): Record<string, unknown> {
  if (detail === "raw") return response;

  const result = { ...response };

  // Obfuscate array fields (neighbors, causal_features, edges, effects)
  for (const key of ["neighbors", "causal_features", "edges", "effects"]) {
    if (Array.isArray(result[key])) {
      result[key] = (result[key] as Array<Record<string, unknown>>).map((item) =>
        obfuscateNeighbor(item, detail)
      );
    }
  }

  // Obfuscate estimate
  if (result["estimate"] && typeof result["estimate"] === "object") {
    const est = { ...(result["estimate"] as Record<string, unknown>) };
    if (detail === "summary") {
      // §9.2: summary hides CIs only. value/direction/probability_positive/horizon kept.
      delete est["confidence_interval"];
      delete est["interval_method"];
    }
    result["estimate"] = est;
  }

  // Remove paths at summary (top-level paths + per-effect causal_path)
  if (detail === "summary") {
    if (result["paths"]) {
      delete result["paths"];
    }
    // Strip causal_path from effects array items
    if (Array.isArray(result["effects"])) {
      result["effects"] = (result["effects"] as Array<Record<string, unknown>>).map((e) => {
        const copy = { ...e };
        delete copy["causal_path"];
        return copy;
      });
    }
  }

  return result;
}
