// src/security/tiers.ts
//
// §9.1 Access tier enforcement.
// Verb patterns match the access_tiers declared in the Capability Card.

import type { ResponseDetail } from "./obfuscation.js";

// Define locally to respect layer boundary (security/ → cap/ only, not config/)
export type AccessTier = "public" | "standard" | "enterprise";

// Verb patterns per tier — mirrors capability-card.ts access_tiers
const TIER_VERBS: Record<AccessTier, string[]> = {
  public: ["observe.predict", "traverse.parents", "meta.*"],
  standard: ["observe.*", "traverse.*", "effect.*", "graph.*", "intervene.do", "meta.*"],
  enterprise: ["*"],
};

const TIER_DETAIL: Record<AccessTier, ResponseDetail> = {
  public: "summary",
  standard: "full",
  enterprise: "raw",
};

/**
 * Check if a verb matches a pattern.
 * Patterns: exact ("observe.predict"), category wildcard ("meta.*"), or star ("*").
 */
export function matchesVerbPattern(verb: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith(".*")) {
    const category = pattern.slice(0, -2);
    return verb.startsWith(category + ".");
  }
  return verb === pattern;
}

/**
 * Check if a verb is allowed for the given access tier.
 */
export function checkVerbAccess(verb: string, tier: AccessTier): boolean {
  const patterns = TIER_VERBS[tier];
  return patterns.some((p) => matchesVerbPattern(verb, p));
}

/**
 * Get the response_detail level for a given access tier.
 */
export function getResponseDetail(tier: AccessTier): ResponseDetail {
  return TIER_DETAIL[tier];
}
