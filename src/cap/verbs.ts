/**
 * CAP Verb Registry — v0.2.2 §6
 *
 * Defines which verbs exist, their conformance tier (core/convenience),
 * and which conformance level (L1/L2/L3) they require.
 */

export interface VerbDefinition {
  name: string;
  category: string;
  tier: "core" | "convenience";
  minLevel: 1 | 2 | 3;
  requiresReasoningMode: boolean;
  requiresAssumptions: boolean;
}

export const VERB_REGISTRY: Record<string, VerbDefinition> = {
  // ── Core Verbs ────────────────────────────────────────
  "meta.capabilities": {
    name: "meta.capabilities",
    category: "meta",
    tier: "core",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "graph.neighbors": {
    name: "graph.neighbors",
    category: "graph",
    tier: "core",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "graph.paths": {
    name: "graph.paths",
    category: "graph",
    tier: "core",
    minLevel: 2,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "effect.query": {
    name: "effect.query",
    category: "effect",
    tier: "core",
    minLevel: 1, // L1 for observational, L2 for interventional
    requiresReasoningMode: false, // depends on query_type
    requiresAssumptions: false,
  },

  // ── Convenience: Observe ──────────────────────────────
  "observe.predict": {
    name: "observe.predict",
    category: "observe",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "observe.predict_multistep": {
    name: "observe.predict_multistep",
    category: "observe",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "observe.predict_batch": {
    name: "observe.predict_batch",
    category: "observe",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "observe.attribute": {
    name: "observe.attribute",
    category: "observe",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },

  // ── Convenience: Traverse ─────────────────────────────
  "traverse.parents": {
    name: "traverse.parents",
    category: "traverse",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "traverse.children": {
    name: "traverse.children",
    category: "traverse",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "traverse.path": {
    name: "traverse.path",
    category: "traverse",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "traverse.subgraph": {
    name: "traverse.subgraph",
    category: "traverse",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "traverse.latest_values": {
    name: "traverse.latest_values",
    category: "traverse",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },

  // ── Convenience: Intervene (L2) ───────────────────────
  "intervene.do": {
    name: "intervene.do",
    category: "intervene",
    tier: "convenience",
    minLevel: 2,
    requiresReasoningMode: true,
    requiresAssumptions: true,
  },
  "intervene.ate": {
    name: "intervene.ate",
    category: "intervene",
    tier: "convenience",
    minLevel: 2,
    requiresReasoningMode: true,
    requiresAssumptions: true,
  },
  "intervene.sensitivity": {
    name: "intervene.sensitivity",
    category: "intervene",
    tier: "convenience",
    minLevel: 2,
    requiresReasoningMode: true,
    requiresAssumptions: true,
  },

  // ── Convenience: Meta ─────────────────────────────────
  "meta.graph_info": {
    name: "meta.graph_info",
    category: "meta",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "meta.node_info": {
    name: "meta.node_info",
    category: "meta",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "meta.algorithms": {
    name: "meta.algorithms",
    category: "meta",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
  "meta.health": {
    name: "meta.health",
    category: "meta",
    tier: "convenience",
    minLevel: 1,
    requiresReasoningMode: false,
    requiresAssumptions: false,
  },
} as const;

/** Get all verbs supported at a given conformance level */
export function getVerbsForLevel(level: 1 | 2): VerbDefinition[] {
  return Object.values(VERB_REGISTRY).filter((v) => v.minLevel <= level);
}

/** Check if a verb requires L2 causal semantics */
export function verbRequiresL2Semantics(verbName: string): boolean {
  const verb = VERB_REGISTRY[verbName];
  return verb?.requiresReasoningMode === true;
}
