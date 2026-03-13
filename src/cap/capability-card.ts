/**
 * Abel's CAP Capability Card — v0.2.2 §4
 *
 * Machine-readable self-description of Abel's causal engine.
 * Served at /.well-known/cap.json.
 */

import { VERB_REGISTRY } from "./verbs.js";

export function buildCapabilityCard(endpoint: string) {
  const coreVerbs = Object.values(VERB_REGISTRY)
    .filter((v) => v.tier === "core" && v.minLevel <= 2)
    .map((v) => v.name);

  const convenienceVerbs = Object.values(VERB_REGISTRY)
    .filter((v) => v.tier === "convenience" && v.minLevel <= 2)
    .map((v) => v.name);

  return {
    $schema: "https://causalagentprotocol.org/schema/capability-card/v0.2.2.json",

    // ── Identity ──
    name: "Abel Social Physical Engine",
    description:
      "GPU-accelerated causal world model covering 150+ financial instruments. Powered by PCMCI on H100 clusters with Neo4j graph backend.",
    version: "1.0.0",
    cap_spec_version: "0.2.2",
    provider: { name: "Abel AI", url: "https://abel.ai" },
    endpoint,

    // ── Conformance ──
    conformance_level: 2,
    supported_verbs: {
      core: coreVerbs,
      convenience: convenienceVerbs,
    },

    // ── Causal Engine Disclosure ──
    causal_engine: {
      family: "constraint-based",
      algorithm: "PCMCI",
      discovery_method: "conditional_independence",
      supports_time_lag: true,
      supports_latent_variables: false,
      supports_nonlinear: true,
      supports_instantaneous: false,
      structural_mechanisms: {
        available: true,
        families: ["linear", "gbdt"],
        nodes_with_fitted_mechanisms: 420,
        residuals_computable: true,
        residual_semantics: "additive",
        mechanism_override_supported: true,
        counterfactual_ready: true,
      },
    },

    // ── Detailed Capabilities ──
    detailed_capabilities: {
      graph_discovery: true,
      graph_traversal: true,
      temporal_multi_lag: true,
      effect_estimation: true,
      intervention_simulation: true,
      counterfactual_scm: false,
      latent_confounding_modeled: false,
      partial_identification: false,
      uncertainty_quantified: true,
    },

    // ── Assumptions ──
    assumptions: [
      "causal_sufficiency",
      "faithfulness",
      "stationarity",
      "no_instantaneous_effects",
      "mechanism_invariance_under_intervention",
    ],

    // ── Reasoning Modes ──
    reasoning_modes_supported: ["scm_simulation", "graph_propagation"],

    // ── Graph Metadata ──
    graph: {
      domains: ["finance", "crypto", "macro-economics", "equities"],
      node_count: 450,
      edge_count: 3200,
      node_types: [
        "asset_price",
        "macro_indicator",
        "on_chain_metric",
        "volatility_index",
      ],
      edge_types_supported: ["directed_lagged"],
      graph_representation: "time_lagged_dag",
      update_frequency: "PT4H",
      temporal_resolution: "PT1H",
      coverage_description:
        "Crypto majors, US equities (S&P500 components), macro indicators (rates, CPI, PMI), select on-chain metrics",
    },

    // ── Uncertainty ──
    uncertainty_methods_supported: ["bootstrap"],

    // ── Authentication ──
    authentication: {
      type: "api_key",
      details: {
        header: "X-CAP-Key",
        signup_url: "https://abel.ai/cap/keys",
      },
    },

    // ── Access Tiers ──
    access_tiers: [
      {
        tier: "public",
        verbs: ["observe.predict", "traverse.parents", "meta.*"],
        response_detail: "summary",
        rate_limit: { requests_per_hour: 100 },
      },
      {
        tier: "standard",
        verbs: ["observe.*", "traverse.*", "effect.*", "graph.*", "intervene.*", "meta.*"],
        response_detail: "full",
        rate_limit: { requests_per_hour: 1000 },
      },
      {
        tier: "enterprise",
        verbs: ["*"],
        response_detail: "raw",
        rate_limit: { requests_per_hour: 10000 },
      },
    ],

    // ── Disclosure Policy ──
    disclosure_policy: {
      weight_detail: "quantized",
      path_detail: "truncated",
      default_response_detail: "full",
    },

    // ── Bindings ──
    bindings: {
      mcp: { enabled: true, endpoint: `${endpoint}/mcp` },
      a2a: {
        enabled: true,
        agent_card_url: `${endpoint}/.well-known/agent-card.json`,
      },
    },
  };
}
