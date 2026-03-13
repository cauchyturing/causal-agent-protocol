# Causal Agent Protocol (CAP) — Protocol Specification

**Version**: 0.2.2-draft  
**Status**: Draft  
**Authors**: Abel AI  
**Date**: 2026-03-12  
**License**: Apache 2.0 (spec); implementations may vary  
**Changelog**: See [Appendix D](#appendix-d-changelog-from-v01)

---

## Notation Conventions

Throughout this document:

- **[NORMATIVE]** marks sections that define protocol requirements. Implementations MUST conform to these sections for the declared conformance level.
- **[INFORMATIVE]** marks sections that provide context, motivation, examples, or recommendations. These sections aid understanding but do not define requirements.
- The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", "MAY" are used per [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

---

## Abstract

**[INFORMATIVE]**

The Causal Agent Protocol (CAP) is an open protocol that defines how AI agents discover, invoke, and compose **causal reasoning capabilities** from any compliant causal engine.

CAP is an **independent causal semantics layer**. It is not a replacement for MCP or A2A. It defines causal-specific capability discovery, verb semantics, assumption disclosure, and response provenance that neither MCP's tool-call model nor A2A's task-delegation model natively express. CAP operates over its own HTTP binding and provides optional MCP and A2A bindings for integration with existing agent ecosystems.

Any organization operating a causal inference system — whether built on PCMCI, PC, GES, FCI, NOTEARS, LiNGAM, DAG-GNN, Granger methods, or proprietary engines — can implement a CAP-compliant server at the appropriate conformance level. Different engines have different causal capabilities; CAP requires each server to **honestly declare** what it can and cannot do.

### What CAP Is Not

- CAP does NOT define how causal discovery is performed (that is the engine's job).
- CAP does NOT provide agent orchestration (that is A2A's job).
- CAP does NOT define how data is ingested or tools are invoked (that is MCP's job).
- CAP does NOT guarantee that all compliant servers produce interchangeable results. Different engines, algorithms, and assumptions yield different causal conclusions. CAP standardizes the **interface and disclosure**, not the **science**.

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Design Principles](#2-design-principles)
3. [Architecture](#3-architecture)
4. [Capability Card](#4-capability-card)
5. [Causal Semantics Model](#5-causal-semantics)
6. [Verb Definitions](#6-verbs)
7. [Message Format](#7-message-format)
8. [Transport Bindings](#8-transport)
9. [Security Model](#9-security)
10. [Conformance Levels](#10-conformance)
11. [Relationship to MCP and A2A](#11-relationship)
12. [Extension Mechanism](#12-extensions)
13. [Reference Implementation Guidance](#13-reference-impl)

Appendices:
- [A: Protocol Comparison](#appendix-a)
- [B: Glossary](#appendix-b)
- [C: Canonical Enum Values](#appendix-c)
- [D: Changelog from v0.1](#appendix-d-changelog-from-v01)

---

## 1. Motivation <a name="1-motivation"></a>

**[INFORMATIVE]**

### 1.1 The Gap in the Current Agent Stack

The agentic AI ecosystem has converged on two protocol families:

- **MCP** (Model Context Protocol, Anthropic, 2024; donated to AAIF December 2025): Standardizes how an AI agent connects to external tools, data sources, and services. MCP's primary transports are **stdio** (for local integrations) and **Streamable HTTP** (for remote servers). Legacy HTTP+SSE transport is retained for backward compatibility.

- **A2A** (Agent-to-Agent Protocol, Google, April 2025; contributed to Linux Foundation June 2025): Standardizes how AI agents discover each other, communicate, and coordinate tasks. IBM's Agent Communication Protocol (ACP) merged into A2A in August 2025. A2A uses HTTP, SSE, and webhooks, with Agent Cards served at `/.well-known/agent-card.json` for capability discovery.

MCP is governed under the **Agentic AI Foundation (AAIF)**, formed in December 2025 under the Linux Foundation, with founding contributions from Anthropic (MCP), Block (goose), and OpenAI (AGENTS.md), and platinum membership from AWS, Google, Microsoft, and others. A2A is a separate **Linux Foundation project** with ecosystem overlap and complementary goals.

Neither protocol natively addresses:

- **Causal capability discovery**: Can this engine do interventions? Counterfactuals? What assumptions does it make?
- **Causal graph semantics**: Directed edges, time lags, partial orientation, causal strength.
- **Pearl's causal hierarchy**: The distinction between observation (Level 1), intervention (Level 2), and counterfactual reasoning (Level 3).
- **Assumption transparency**: What must be true for a causal claim to hold?
- **Inference provenance**: Which algorithm, which graph version, what confidence?

### 1.2 Why Not MCP Tools?

An implementer could expose a causal engine as MCP tools. This works for basic access but creates structural problems:

- **No programmatic capability discovery**: MCP tool descriptions are free text. An agent cannot machine-read "does this server support do-calculus?" or "what causal assumptions does it make?"
- **No standard causal objects**: Every MCP tool invents its own format for graphs, edges, predictions, and interventions. Results cannot be compared across engines.
- **No assumption disclosure**: MCP has no standard for communicating that a result depends on causal sufficiency, faithfulness, or linearity assumptions.
- **No causal provenance**: MCP responses carry no structured information about algorithm, graph version, identification status, or confidence methodology.

CAP addresses these gaps. It defines a causal-specific capability card, standard causal verbs with semantic constraints, mandatory assumption disclosure for interventional/counterfactual claims, and structured provenance. CAP's value proposition is:

> **Let AI agents know what causal reasoning they are invoking, what assumptions it rests on, and how much to trust the result.**

### 1.3 Who Can Implement CAP?

**[INFORMATIVE]**

Any entity operating a causal inference system:

| Implementer Type | Examples | Typical Conformance |
|---|---|---|
| Causal AI companies | Abel AI, CausaLens, causaLab | Level 1–2 |
| Academic labs | CMU Causal Lab, UCSD (causal-learn) | Level 1 |
| Cloud providers | AWS, GCP, Azure managed services | Level 1–2 |
| Enterprise platforms | Palantir, Databricks | Level 1–2 |
| Time-series / Granger services | Various | Level 1 |
| SCM-based research engines | With full structural equations | Level 1–3 |

Note: Different algorithms have fundamentally different causal capabilities. A Granger causality service and a structural causal model (SCM) engine both qualify for CAP compliance, but at different levels and with different `detailed_capabilities` declarations. CAP does not equate them; it requires each to **honestly disclose** its nature. See §5 (Causal Semantics Model) and §10 (Conformance Levels).

---

## 2. Design Principles <a name="2-design-principles"></a>

**[INFORMATIVE]**

1. **Semantic Honesty Over Completeness**  
   The protocol may be incomplete, but it must not be misleading. Every server MUST disclose the assumptions and reasoning mode behind its causal claims. A prediction labeled `graph_propagation` is more useful than one with no label at all.

2. **Adoption Friction Minimization**  
   A first external implementer should be able to build a Level 1 CAP server in days, not months. The protocol prioritizes concrete verbs and examples over abstract generality.

3. **Engine Agnosticism**  
   CAP does not mandate any causal inference algorithm. PCMCI, PC, GES, FCI, NOTEARS, LiNGAM, DAG-GNN, Granger, SCM — all are valid backends. The protocol standardizes the **interface and disclosure**, not the computation.

4. **Progressive Enhancement**  
   Conformance levels (L1 → L2 → L3) let simple implementations participate without supporting the full spec. A Granger-causality service is a valid Level 1 server.

5. **Future Upgradability**  
   Early versions are deliberately lightweight. But every schema includes extension points so the protocol can evolve toward richer object models (edge semantics, estimand algebra, uncertainty decomposition) without breaking backward compatibility.

6. **Independent Layer, Multiple Bindings**  
   CAP is not a subset of MCP or A2A. It defines its own semantics and can be consumed via native HTTP, via MCP tool binding, or discovered via A2A Agent Card. The binding does not change the semantics.

---

## 3. Architecture <a name="3-architecture"></a>

**[NORMATIVE]**

### 3.1 Roles

- **CAP Client**: Any entity that invokes causal reasoning — an LLM-based agent, application, workflow engine, or another agent via A2A delegation.
- **CAP Server**: An entity hosting a causal model/graph that exposes CAP verbs. Responsible for actual causal computation and honest capability/assumption disclosure.

### 3.2 Protocol Flow

```
1. DISCOVER    Client fetches Capability Card at /.well-known/cap.json
               → Learns: domains, graph coverage, supported verbs,
                 conformance level, detailed capabilities, assumptions,
                 algorithm family, access tiers

2. AUTHENTICATE  Client presents credentials per Capability Card auth config
                 → Receives access tier (determines verb availability
                   and response detail level)

3. INVOKE      Client sends CAP verb request
               → Server performs causal computation
               → Returns structured CausalResponse with provenance
                 and (for L2/L3 verbs) mandatory reasoning_mode,
                 identification_status, and assumptions

4. INTERPRET   Client uses response metadata (reasoning_mode,
               assumptions, confidence) to calibrate trust in
               the causal claim before acting on it
```

### 3.3 Statefulness

**[NORMATIVE]**

CAP v0.2 is **stateless**. Every request is self-contained. There is no session concept, no server-side state between requests, and no resumability.

Servers MAY include a `graph_version` identifier in responses so clients can detect when the underlying causal graph has changed between requests. But this is informational, not a session mechanism.

Future versions MAY introduce session semantics (graph snapshot pinning, long-running async jobs). If so, they will be defined as an explicit extension with full lifecycle specification.

---

## 4. Capability Card <a name="4-capability-card"></a>

**[NORMATIVE]**

Every CAP server MUST serve a Capability Card as a JSON document at `/.well-known/cap.json`.

The Capability Card is CAP's most critical contribution. It transforms causal engines from opaque black boxes into machine-readable, discoverable services with explicit capability boundaries.

### 4.1 Schema

```json
{
  "$schema": "https://causalagentprotocol.org/schema/capability-card/v0.2.2.json",

  // ── Identity ──────────────────────────────────────────────
  "name": "string",                           // REQUIRED
  "description": "string",                    // REQUIRED
  "version": "string",                        // REQUIRED. semver
  "cap_spec_version": "0.2.2",               // REQUIRED. CAP spec version
  "provider": {                               // REQUIRED
    "name": "string",
    "url": "string"
  },
  "endpoint": "string",                       // REQUIRED. Base URL for CAP requests

  // ── Conformance ───────────────────────────────────────────
  "conformance_level": 1 | 2,                 // REQUIRED. See §10.
                                               // (Level 3 reserved for future spec)

  "supported_verbs": {                        // REQUIRED
    "core": ["string"],                       // Core verbs (MUST for declared level)
    "convenience": ["string"]                 // Convenience verbs (SHOULD)
  },

  // ── Causal Engine Disclosure ──────────────────────────────
  "causal_engine": {                          // REQUIRED
    "family": "string",                       // "constraint-based" | "score-based" |
                                               // "fcm" | "granger" | "hybrid" |
                                               // "neural" | "scm" | "other"
    "algorithm": "string",                    // e.g. "PCMCI", "PC", "GES", "NOTEARS"
    "discovery_method": "string",             // More specific: "conditional_independence" |
                                               // "score_optimization" | "continuous_optimization" |
                                               // "granger_regression" | "other"
    "supports_time_lag": true | false,
    "supports_latent_variables": true | false,
    "supports_nonlinear": true | false,
    "supports_instantaneous": true | false,

    // ── Structural Mechanisms (nested in causal_engine) ─────
    // OPTIONAL in schema, but CONDITIONALLY REQUIRED:
    // Servers declaring "scm_simulation" in reasoning_modes_supported
    // MUST include this object with available=true and
    // mechanism_override_supported=true.
    "structural_mechanisms": {              // OPTIONAL (conditionally required)
      "available": true | false,           // Are fitted mechanisms present?
      "families": ["string"],              // "linear" | "gbdt" | "neural" | "gam" |
                                            // "polynomial" | "other"
      "nodes_with_fitted_mechanisms": 0,   // How many endogenous nodes have mechanisms.
                                            // Compare with graph.node_count for coverage.
      "residuals_computable": true | false,  // Can compute ε_i = V_i - f_i(pa_i)?
      "residual_semantics": "string",      // "additive" | "implicit" | "mixed"
                                            // "additive": V_i = f_i(pa_i) + ε_i
                                            // "implicit": residual not explicitly modeled
                                            // "mixed": varies by node / mechanism family
      "mechanism_override_supported": true | false,  // Can do graph mutilation: replace
                                            // intervened node's mechanism with fixed value,
                                            // keep other mechanisms invariant, re-solve?
                                            // This is the core scm_simulation requirement.
      "counterfactual_ready": true | false // Can do abduction-action-prediction?
                                            // (L3 is protocol-reserved; this signals
                                            // technical readiness, not conformance.)
    }
  },

  // ── Detailed Capabilities ─────────────────────────────────
  // Agent reads conformance_level for coarse signal.
  // Advanced clients / humans read this block for precise capabilities.
  "detailed_capabilities": {                  // REQUIRED
    "graph_discovery": true | false,
    "graph_traversal": true | false,
    "temporal_multi_lag": true | false,
    "effect_estimation": true | false,
    "intervention_simulation": true | false,
    "counterfactual_scm": true | false,
    "latent_confounding_modeled": true | false,
    "partial_identification": true | false,
    "uncertainty_quantified": true | false
  },

  // ── Assumptions ───────────────────────────────────────────
  "assumptions": [                            // REQUIRED. What the engine assumes.
    "string"                                  // See Appendix C for canonical values
  ],

  // ── Reasoning Modes ───────────────────────────────────────
  "reasoning_modes_supported": [              // REQUIRED. Which modes this engine's
    "string"                                  //   L2 responses may declare.
  ],                                          // See Appendix C for canonical values

  // ── Graph Metadata ────────────────────────────────────────
  "graph": {                                  // REQUIRED
    "domains": ["string"],
    "node_count": 0,                          // Approximate
    "edge_count": 0,                          // Approximate
    "node_types": ["string"],
    "edge_types_supported": ["string"],       // e.g. ["directed_lagged"]
                                               // See Appendix C for canonical values.
                                               // v0.2 requires at least "directed_lagged"
                                               // or "directed". Future versions may add
                                               // "partially_oriented", "bidirected", etc.
    "graph_representation": "string",         // "dag" | "cpdag" | "pag" | "weighted_adjacency"
                                               // | "time_lagged_dag" | "other"
                                               // NOTE: For "cpdag" or "pag", see §6.5 for
                                               // normative constraints on graph.neighbors behavior.
    "update_frequency": "string",             // ISO 8601 duration, e.g. "PT4H"
    "temporal_resolution": "string",          // Finest tau granularity, e.g. "PT1H"
    "coverage_description": "string"
  },

  // ── Uncertainty ───────────────────────────────────────────
  "uncertainty_methods_supported": [          // OPTIONAL. How confidence intervals
    "string"                                  //   are computed.
  ],                                          // See Appendix C for canonical values

  // ── Authentication ────────────────────────────────────────
  "authentication": {                         // REQUIRED
    "type": "none" | "api_key" | "oauth2",
    "details": {}                             // Type-specific config.
                                               // For oauth2: authorization_url, token_url, scopes.
                                               // For api_key: header name.
                                               // MCP's authorization spec is OPTIONAL and
                                               // applies only when using the MCP HTTP binding.
  },

  // ── Access Tiers ──────────────────────────────────────────
  "access_tiers": [                           // OPTIONAL. Progressive disclosure.
    {
      "tier": "string",                       // e.g. "public", "standard", "enterprise"
      "verbs": ["string"],                    // Available verbs at this tier
      "response_detail": "summary" | "full" | "raw",
      "rate_limit": { "requests_per_hour": 0 }
    }
  ],

  // ── Disclosure Policy ────────────────────────────────────
  "disclosure_policy": {                      // OPTIONAL but RECOMMENDED.
                                               // Documents how the server obfuscates
                                               // responses at non-raw detail levels.
    "weight_detail": "string",               // "raw" | "quantized" | "ranked" | "hidden"
    "path_detail": "string",                 // "full" | "truncated" | "hidden"
    "default_response_detail": "string"      // "summary" | "full" | "raw"
  },

  // ── Bindings ──────────────────────────────────────────────
  "bindings": {                               // OPTIONAL
    "mcp": {
      "enabled": true | false,
      "endpoint": "string"                    // MCP server endpoint (Streamable HTTP or stdio)
    },
    "a2a": {
      "enabled": true | false,
      "agent_card_url": "string"              // URL to A2A Agent Card at
                                               // /.well-known/agent-card.json
    }
  },

  // ── Extensions ────────────────────────────────────────────
  "extensions": {}                            // OPTIONAL. Domain-specific extensions. See §12.
}
```

### 4.2 Example: Abel AI (PCMCI, Level 2)

**[INFORMATIVE]**

```json
{
  "name": "Abel Social Physical Engine",
  "description": "GPU-accelerated causal world model covering 150+ financial instruments. Powered by PCMCI on H100 clusters with Neo4j graph backend.",
  "version": "1.0.0",
  "cap_spec_version": "0.2.2",
  "provider": { "name": "Abel AI", "url": "https://abel.ai" },
  "endpoint": "https://cap.abel.ai/v1",

  "conformance_level": 2,
  "supported_verbs": {
    "core": [
      "meta.capabilities", "graph.neighbors", "graph.paths", "effect.query"
    ],
    "convenience": [
      "observe.predict", "observe.predict_multistep", "observe.predict_batch",
      "observe.attribute",
      "traverse.parents", "traverse.children", "traverse.path",
      "traverse.subgraph", "traverse.latest_values",
      "intervene.do",
      "meta.graph_info", "meta.node_info", "meta.algorithms", "meta.health"
    ]
  },

  "causal_engine": {
    "family": "constraint-based",
    "algorithm": "PCMCI",
    "discovery_method": "conditional_independence",
    "supports_time_lag": true,
    "supports_latent_variables": false,
    "supports_nonlinear": true,
    "supports_instantaneous": false,
    "structural_mechanisms": {
      "available": true,
      "families": ["linear", "gbdt"],
      "nodes_with_fitted_mechanisms": 420,
      "residuals_computable": true,
      "residual_semantics": "additive",
      "mechanism_override_supported": true,
      "counterfactual_ready": true
    }
  },

  "detailed_capabilities": {
    "graph_discovery": true,
    "graph_traversal": true,
    "temporal_multi_lag": true,
    "effect_estimation": true,
    "intervention_simulation": true,
    "counterfactual_scm": false,
    "latent_confounding_modeled": false,
    "partial_identification": false,
    "uncertainty_quantified": true
  },

  "assumptions": [
    "causal_sufficiency",
    "faithfulness",
    "stationarity",
    "no_instantaneous_effects",
    "mechanism_invariance_under_intervention"
  ],

  "reasoning_modes_supported": [
    "scm_simulation",
    "graph_propagation"
  ],

  "graph": {
    "domains": ["finance", "crypto", "macro-economics", "equities"],
    "node_count": 450,
    "edge_count": 3200,
    "node_types": ["asset_price", "macro_indicator", "on_chain_metric", "volatility_index"],
    "edge_types_supported": ["directed_lagged"],
    "graph_representation": "time_lagged_dag",
    "update_frequency": "PT4H",
    "temporal_resolution": "PT1H",
    "coverage_description": "Crypto majors, US equities (S&P500 components), macro indicators (rates, CPI, PMI), select on-chain metrics"
  },

  "uncertainty_methods_supported": ["bootstrap"],

  "authentication": {
    "type": "api_key",
    "details": { "header": "X-CAP-Key", "signup_url": "https://abel.ai/cap/keys" }
  },

  "access_tiers": [
    { "tier": "public", "verbs": ["observe.predict", "traverse.parents", "meta.*"], "response_detail": "summary", "rate_limit": { "requests_per_hour": 100 } },
    { "tier": "standard", "verbs": ["observe.*", "traverse.*", "intervene.do", "meta.*"], "response_detail": "full", "rate_limit": { "requests_per_hour": 1000 } },
    { "tier": "enterprise", "verbs": ["*"], "response_detail": "raw", "rate_limit": { "requests_per_hour": 10000 } }
  ],

  "disclosure_policy": {
    "weight_detail": "quantized",
    "path_detail": "truncated",
    "default_response_detail": "full"
  },

  "bindings": {
    "mcp": { "enabled": true, "endpoint": "https://cap.abel.ai/mcp" },
    "a2a": { "enabled": true, "agent_card_url": "https://cap.abel.ai/.well-known/agent-card.json" }
  }
}
```

### 4.3 Example: Hypothetical Granger Service (Level 1)

**[INFORMATIVE]**

This example demonstrates that CAP Level 1 accommodates simpler methods while making their limitations machine-readable.

```json
{
  "name": "QuickCause Granger API",
  "description": "Granger-causality-based prediction service for macro-economic indicators.",
  "version": "0.5.0",
  "cap_spec_version": "0.2.2",
  "provider": { "name": "QuickCause Inc.", "url": "https://quickcause.io" },
  "endpoint": "https://api.quickcause.io/cap/v1",

  "conformance_level": 1,
  "supported_verbs": {
    "core": ["meta.capabilities", "graph.neighbors", "effect.query"],
    "convenience": ["observe.predict", "traverse.parents", "meta.health"]
  },

  "causal_engine": {
    "family": "granger",
    "algorithm": "VAR-Granger",
    "discovery_method": "granger_regression",
    "supports_time_lag": true,
    "supports_latent_variables": false,
    "supports_nonlinear": false,
    "supports_instantaneous": false
  },

  "detailed_capabilities": {
    "graph_discovery": true,
    "graph_traversal": true,
    "temporal_multi_lag": true,
    "effect_estimation": false,
    "intervention_simulation": false,
    "counterfactual_scm": false,
    "latent_confounding_modeled": false,
    "partial_identification": false,
    "uncertainty_quantified": true
  },

  "assumptions": [
    "granger_predictive_causality_only",
    "stationarity",
    "linearity",
    "no_latent_confounders_addressed"
  ],

  "reasoning_modes_supported": ["conditional_forecast"],

  "graph": {
    "domains": ["macro-economics"],
    "node_count": 50,
    "edge_count": 200,
    "node_types": ["macro_indicator"],
    "edge_types_supported": ["directed_lagged"],
    "graph_representation": "weighted_adjacency",
    "update_frequency": "PT24H",
    "temporal_resolution": "PT24H",
    "coverage_description": "US macro indicators: GDP, CPI, unemployment, Fed funds rate, 10Y yield, etc."
  },

  "uncertainty_methods_supported": ["asymptotic"],

  "authentication": { "type": "api_key", "details": { "header": "X-CAP-Key" } }
}
```

An agent reading this card immediately knows: this is Granger-based, it does not model latent confounders, it cannot do interventions, and its "causal" claims are predictive-causality-only. The agent can calibrate trust accordingly.

---

## 5. Causal Semantics Model <a name="5-causal-semantics"></a>

**[NORMATIVE]**

This section defines the semantic objects and disclosure requirements that make CAP more than a generic prediction API. It is the core normative contribution of the protocol.

### 5.1 Reasoning Mode

Every CAP response to an `intervene.*` or `counterfact.*` verb MUST include a `reasoning_mode` field declaring how the result was computed.

| Value | Meaning | Typical Engine |
|-------|---------|----------------|
| `identified_causal_effect` | Result is a formally identified causal effect under the disclosed assumptions, using adjustment formula, front-door criterion, instrumental variables, or equivalent | SCM-based engines with identifiability proofs |
| `scm_simulation` | Result is computed by executing fitted structural mechanisms under intervention semantics. The server MUST represent endogenous variables with explicit mechanisms (f_i), MUST replace or override the intervened variable's mechanism under do(...), and MUST solve the modified system while keeping non-intervened mechanisms fixed. For time-lagged systems, forward solving proceeds in temporal order from the intervention time point, respecting tau delays. Mechanisms MAY be theory-derived or data-fitted (linear, GBDT, neural, GAM, etc.). **This label does not imply formal identification.** Servers MUST NOT return this mode unless all nodes in the causal path(s) from intervention to reported target(s) are covered by executable mechanisms (see §6.6, Partial Coverage Rule). | Engines with fitted structural mechanisms and mechanism override capability |
| `graph_propagation` | Result is computed by propagating values along discovered directed edges using estimated coefficients. Not formally identified as an interventional effect. | PCMCI, NOTEARS, DAG-GNN with linear propagation |
| `reduced_form_estimate` | Result is estimated via reduced-form regression or matching, without explicit graph structure | DoWhy-style estimation without full graph |
| `conditional_forecast` | Result is a conditional prediction (e.g., Granger-style), not an interventional effect. Susceptible to confounding. | VAR, Granger, ARIMA-X |
| `heuristic` | Result is computed via a heuristic or approximation with no formal causal justification | Custom / proprietary methods |

Servers MUST NOT use `identified_causal_effect` or `scm_simulation` unless the engine genuinely performs the corresponding computation. Mislabeling is a conformance violation.

**Claim-to-card binding**: Servers declaring `scm_simulation` in `reasoning_modes_supported` MUST include the `causal_engine.structural_mechanisms` object in their Capability Card with `available: true` and `mechanism_override_supported: true`. Absence of this object while claiming `scm_simulation` is a conformance violation.

### 5.2 Identification Status

Every CAP response to an `intervene.*` or `counterfact.*` verb MUST include an `identification_status` field.

| Value | Meaning |
|-------|---------|
| `identified` | The target causal estimand is formally identified from the given graph and assumptions |
| `partially_identified` | Bounds on the causal effect are available but not a point estimate |
| `not_formally_identified` | The result is an estimate or simulation, but formal identification has not been established |
| `not_applicable` | The verb does not involve an interventional or counterfactual claim (e.g., `observe.*`) |

### 5.3 Assumptions Disclosure

Every CAP Capability Card MUST include an `assumptions` array listing the assumptions the engine depends on. Individual responses MAY include their own `assumptions` array; when present, the response-level array MUST be interpreted as the **complete effective assumption set** for that response — it is not merged with the Capability Card assumptions.

Canonical assumption values are listed in [Appendix C](#appendix-c). Common examples:

| Assumption | Meaning |
|-----------|---------|
| `causal_sufficiency` | No latent common causes of measured variables |
| `faithfulness` | All conditional independencies in the data reflect the true causal structure |
| `acyclicity` | The causal graph contains no directed cycles |
| `stationarity` | The causal relationships do not change over time |
| `linearity` | Causal relationships are modeled as linear |
| `no_instantaneous_effects` | All causal effects have non-zero time lag |
| `granger_predictive_causality_only` | "Causality" means predictive precedence only, not interventional causation |
| `no_latent_confounders_addressed` | The engine does not attempt to handle unmeasured confounding |
| `mechanism_invariance_under_intervention` | Non-intervened structural mechanisms remain invariant when an intervention is applied. Core assumption for `scm_simulation`. |

### 5.4 The Science Boundary

**[INFORMATIVE]**

CAP deliberately does not attempt to standardize causal science itself. Different algorithms produce different types of graphs (DAGs, CPDAGs, PAGs, weighted adjacency matrices) and different types of causal claims (identified effects, bounds, conditional forecasts, simulations). These differences are scientifically genuine and cannot be papered over by protocol design.

What CAP does instead is require **honest disclosure**:

- If your engine outputs a CPDAG (equivalence class), say `graph_representation: "cpdag"`.
- If your intervention estimate is graph propagation, say `reasoning_mode: "graph_propagation"`.
- If you assume causal sufficiency, say `assumptions: ["causal_sufficiency"]`.
- If you don't model latent confounders, say `latent_confounding_modeled: false`.

This enables the **client** (LLM agent or human) to make informed trust decisions. The protocol does not adjudicate which engine is "more causal" — it gives agents the information to decide for themselves.

---

## 6. Verb Definitions <a name="6-verbs"></a>

**[NORMATIVE]**

### 6.1 Verb Architecture: Core and Convenience

CAP verbs are divided into two tiers:

- **Core Verbs**: The minimal interoperable surface. Conformance testing evaluates these. A server at a given conformance level MUST implement all core verbs for that level.
- **Convenience Verbs**: Concrete, practical verbs that map common use cases. Servers SHOULD implement relevant convenience verbs. These appear in the spec (not as extensions) because they make the protocol immediately useful to developers, but they are not required for conformance.

### 6.2 Core Verbs

```
meta.capabilities          — Return this server's Capability Card
graph.neighbors            — Get immediate causal neighbors (parents and/or children) of a node
graph.paths                — Find causal path(s) between two nodes
effect.query               — Query for a causal effect estimate (observation or intervention)
counterfact.query          — Query for a counterfactual estimate (Level 3, reserved in v0.2)
```

### 6.3 Convenience Verbs

```
observe.predict             — Predict target using causal parents (L1 specialization of effect.query)
observe.predict_multistep   — Multi-horizon cumulative prediction
observe.predict_batch       — Batch predictions for multiple targets
observe.attribute           — Decompose an observation into causal feature contributions

traverse.parents            — Get causal parents of a node (directed specialization of graph.neighbors)
traverse.children           — Get causal children of a node
traverse.path               — Find causal path(s) between two nodes (alias of core graph.paths)
traverse.subgraph           — Extract bounded subgraph around node(s)
traverse.latest_values      — Get latest observed values for node(s)

intervene.do                — Pearl's do(X=x): simulate intervention (L2)
intervene.ate               — Average Treatment Effect estimation (L2)
intervene.sensitivity       — Sensitivity analysis of an intervention (L2)

counterfact.contrast        — Compare factual vs counterfactual outcomes (Level 3, reserved in v0.2)

meta.graph_info             — Graph summary statistics and freshness
meta.node_info              — Detailed info about a specific node
meta.algorithms             — Which algorithms produced the current graph
meta.health                 — Server health check
```

### 6.4 Verb Detail: effect.query (Core)

**[NORMATIVE]**

The primary core verb for obtaining causal estimates. At Level 1, it behaves as observational prediction. At Level 2, it can also perform interventional estimation.

**Request**:
```json
{
  "verb": "effect.query",
  "params": {
    "target": "string",                     // REQUIRED. Target node ID
    "query_type": "observational" | "interventional",  // REQUIRED
    "intervention": {                       // REQUIRED if query_type = "interventional"
      "node_id": "string",
      "value": 0.0,
      "unit": "string"                      // "log_return" | "percentage" | "absolute" | "std_dev"
    },
    "top_k_causes": 0,                     // OPTIONAL. 0 = all
    "include_provenance": true | false,     // OPTIONAL. Default true
    "include_paths": true | false           // OPTIONAL. Default false
  }
}
```

**Response**:
```json
{
  "verb": "effect.query",
  "status": "success",
  "result": {
    "target": "string",
    "query_type": "observational" | "interventional",
    "estimate": {
      "value": 0.0,
      "unit": "string",
      "direction": "up" | "down" | "neutral",
      "probability_positive": 0.0,          // P(effect > 0), 0-1
      "confidence_interval": [0.0, 0.0],    // OPTIONAL
      "interval_method": "string",          // OPTIONAL. "bootstrap" | "analytical" |
                                             //           "posterior" | "none"
      "horizon": "string"                   // ISO 8601 duration
    },
    "causal_features": [ ... ],             // See §6.8 (CausalFeature object)

    // ── Causal Semantics (REQUIRED for interventional) ──
    "reasoning_mode": "string",             // REQUIRED if query_type="interventional"
                                             // See §5.1
    "identification_status": "string",      // REQUIRED if query_type="interventional"
                                             // See §5.2
    "assumptions": ["string"]               // REQUIRED if query_type="interventional"
                                             // See §5.3
  },
  "provenance": { ... }                     // See §6.9
}
```

**Level 1 fallback**: Servers at conformance Level 1 MUST return error code `query_type_not_supported` when receiving `query_type: "interventional"`. The error response SHOULD include a `suggestion` field directing the client to use `query_type: "observational"` or to discover a Level 2 server via capability card.

### 6.5 Verb Detail: graph.neighbors (Core)

**[NORMATIVE]**

**Request**:
```json
{
  "verb": "graph.neighbors",
  "params": {
    "node_id": "string",                    // REQUIRED
    "direction": "parents" | "children" | "both",  // REQUIRED
    "top_k": 0,                             // OPTIONAL. 0 = all (subject to server limit)
    "sort_by": "weight" | "tau" | "name",   // OPTIONAL. Default "weight"
    "include_values": true | false           // OPTIONAL. Include latest observed values
  }
}
```

**Response**:
```json
{
  "verb": "graph.neighbors",
  "status": "success",
  "result": {
    "node_id": "string",
    "direction": "parents" | "children" | "both",
    "neighbors": [
      {
        "node_id": "string",
        "node_name": "string",
        "node_type": "string",
        "domain": "string",
        "edge_type": "string",              // From graph.edge_types_supported
        "weight": 0.0,                      // MAY be obfuscated per access tier
        "tau": 0,                           // Time lag in temporal_resolution units
        "tau_duration": "string",           // ISO 8601, e.g. "PT2H"
        "current_value": 0.0,              // OPTIONAL. If include_values=true
        "current_change_percent": 0.0       // OPTIONAL
      }
    ],
    "intercept": 0.0,                       // OPTIONAL. Model intercept
    "undetermined_neighbor_count": 0         // OPTIONAL. Number of adjacent nodes whose
                                              // edge orientation is undetermined with respect
                                              // to the requested direction. These neighbors
                                              // are NOT included in the neighbors array.
                                              // Relevant for CPDAG/PAG representations.
  },
  "provenance": { ... }
}
```

**Partially-oriented graph representations**: For servers declaring `graph_representation` as `"cpdag"` or `"pag"`, `graph.neighbors` MUST return only neighbors whose edge orientation is determined with respect to the requested `direction`. Servers SHOULD report the count of omitted neighbors via `undetermined_neighbor_count`. This constraint ensures that clients can trust that returned parent/child relationships reflect determined orientations, not ambiguous edges. Full support for partially-oriented edge semantics is deferred to a future spec version.

### 6.6 Verb Detail: intervene.do (Convenience, Level 2)

**[NORMATIVE]**

Simulate Pearl's do-operator: force node(s) to specified value(s), propagate through causal graph, observe effects on target(s).

**Critical semantic note**: The scientific validity of the result depends entirely on the engine's capabilities and assumptions. A `graph_propagation` result from PCMCI is a useful estimate but is **not** the same as a formally identified interventional effect from a complete SCM. The mandatory `reasoning_mode` and `identification_status` fields ensure the client can distinguish these cases.

**Request**:
```json
{
  "verb": "intervene.do",
  "params": {
    "interventions": [                      // REQUIRED
      {
        "node_id": "string",
        "value": 0.0,
        "unit": "string"                    // "log_return" | "percentage" | "absolute" | "std_dev"
      }
    ],
    "targets": ["string"],                  // REQUIRED. Nodes to observe effects on
    "horizon": "string",                    // OPTIONAL. ISO 8601 duration
    "include_paths": true | false           // OPTIONAL
  }
}
```

**Response**:
```json
{
  "verb": "intervene.do",
  "status": "success",
  "result": {
    "interventions": [ ... ],               // Echo
    "effects": [
      {
        "target": "string",
        "expected_change": 0.0,
        "unit": "string",
        "confidence_interval": [0.0, 0.0],  // OPTIONAL
        "interval_method": "string",        // OPTIONAL
        "probability_positive": 0.0,
        "propagation_delay": "string",      // ISO 8601 duration
        "reasoning_mode": "string",         // REQUIRED. Per-effect. See §5.1.
                                             // May differ across targets if some paths
                                             // have full mechanism coverage and others don't.
        "mechanism_coverage_complete": true | false,  // REQUIRED for scm_simulation.
                                             // true = all nodes in solve path had
                                             // executable mechanisms. false = fallback used.
        "causal_path": [                    // OPTIONAL. If include_paths=true
          {
            "from": "string",
            "to": "string",
            "edge_type": "string",
            "tau": 0,
            "weight": 0.0                   // MAY be obfuscated
          }
        ]
      }
    ],

    // ── Mandatory Causal Semantics (result-level) ──
    "identification_status": "string",      // REQUIRED. See §5.2
    "assumptions": ["string"]               // REQUIRED. See §5.3
  },
  "provenance": { ... }
}
```

**Partial Coverage Rule**: Servers MUST NOT return `reasoning_mode: "scm_simulation"` for any individual effect unless all nodes in the causal path(s) from the intervened node(s) to that specific target are covered by executable structural mechanisms with mechanism override support. If any required node on the path to a target lacks an executable mechanism, the server MUST either: (a) return error code `insufficient_mechanism_coverage` for that target, or (b) compute the result using a fallback method and set `reasoning_mode` to the appropriate fallback value (e.g., `graph_propagation`) with `mechanism_coverage_complete: false`. This rule applies per-effect: in a multi-target request, some effects may be `scm_simulation` while others fall back to `graph_propagation`.

### 6.7 Verb Detail: observe.predict (Convenience, Level 1)

**[NORMATIVE]**

Shorthand for `effect.query` with `query_type: "observational"`. The most common verb in practice.

**Request**:
```json
{
  "verb": "observe.predict",
  "params": {
    "target": "string",                     // REQUIRED
    "top_k_causes": 0,                      // OPTIONAL. Default 3
    "feature_selection": "string",          // OPTIONAL. "impact" | "weight" | "tau"
    "include_provenance": true | false      // OPTIONAL
  }
}
```

**Response**:
```json
{
  "verb": "observe.predict",
  "status": "success",
  "result": {
    "target": "string",
    "prediction": {
      "value": 0.0,
      "unit": "string",
      "direction": "up" | "down" | "neutral",
      "probability_positive": 0.0,
      "confidence_interval": [0.0, 0.0],
      "interval_method": "string",
      "horizon": "string"
    },
    "causal_features": [ ... ],            // See §6.8
    "target_context": {
      "latest_value": 0.0,
      "latest_change_percent": 0.0,
      "timestamp": "string"
    }
  },
  "provenance": { ... }
}
```

Note: `observe.predict` does NOT require `reasoning_mode` / `identification_status` / `assumptions` in the response. These are mandatory only for `intervene.*` and `counterfact.*` verbs. Observational predictions are Level 1 and make no interventional claims.

### 6.8 Shared Object: CausalFeature

**[NORMATIVE]**

Used in responses that decompose an estimate into per-feature contributions.

```json
{
  "node_id": "string",
  "node_name": "string",
  "node_type": "string",
  "edge_type": "string",                  // From graph.edge_types_supported
  "impact": 0.0,                           // This feature's contribution to the estimate
  "impact_fraction": 0.0,                 // Fraction of total estimate (0-1)
  "weight": 0.0,                           // Causal coefficient (MAY be obfuscated)
  "tau": 0,                               // Time lag
  "tau_duration": "string",               // ISO 8601
  "current_value": 0.0,                   // OPTIONAL
  "current_change_percent": 0.0           // OPTIONAL
}
```

### 6.9 Shared Object: Provenance

**[NORMATIVE]**

Included in all responses when requested. Provides transparency about how the result was computed.

```json
{
  "algorithm": "string",                   // e.g. "PCMCI"
  "graph_version": "string",              // Server-defined graph version ID
  "graph_timestamp": "string",            // ISO 8601. When graph was last updated
  "computation_time_ms": 0,
  "sample_size": 0,                        // OPTIONAL. Data points used
  "mechanism_family_used": "string",      // OPTIONAL. Which mechanism type was used
                                           // for this computation: "linear" | "gbdt" |
                                           // "neural" | "gam" | "none" (if graph_propagation)
  "mechanism_model_version": "string",    // OPTIONAL. Version ID of the fitted mechanisms
  "server_name": "string",
  "server_version": "string",
  "cap_spec_version": "0.2.2"
}
```

### 6.10 Verb Summary Table

| Verb | Tier | L1 | L2 | Requires reasoning_mode | Requires assumptions |
|------|------|----|----|------------------------|---------------------|
| `meta.capabilities` | Core | ✓ | ✓ | — | — |
| `graph.neighbors` | Core | ✓ | ✓ | — | — |
| `graph.paths` | Core | ✓ | ✓ | — | — |
| `effect.query` (observational) | Core | ✓ | ✓ | — | — |
| `effect.query` (interventional) | Core | — | ✓ | **YES** | **YES** |
| `counterfact.query` | Core | — | — | **YES** | **YES** |
| `observe.predict` | Conv | ✓ | ✓ | — | — |
| `observe.predict_multistep` | Conv | ✓ | ✓ | — | — |
| `observe.predict_batch` | Conv | ✓ | ✓ | — | — |
| `observe.attribute` | Conv | ✓ | ✓ | — | — |
| `traverse.parents` | Conv | ✓ | ✓ | — | — |
| `traverse.children` | Conv | ✓ | ✓ | — | — |
| `traverse.path` | Conv | ✓ | ✓ | — | — |
| `traverse.subgraph` | Conv | ✓ | ✓ | — | — |
| `traverse.latest_values` | Conv | ✓ | ✓ | — | — |
| `intervene.do` | Conv | — | ✓ | **YES** | **YES** |
| `intervene.ate` | Conv | — | ✓ | **YES** | **YES** |
| `intervene.sensitivity` | Conv | — | ✓ | **YES** | **YES** |
| `counterfact.contrast` | Conv | — | — | **YES** | **YES** |
| `meta.graph_info` | Conv | ✓ | ✓ | — | — |
| `meta.node_info` | Conv | ✓ | ✓ | — | — |
| `meta.algorithms` | Conv | ✓ | ✓ | — | — |
| `meta.health` | Conv | ✓ | ✓ | — | — |

---

## 7. Message Format <a name="7-message-format"></a>

**[NORMATIVE]**

### 7.1 Request Envelope

```json
{
  "cap_version": "0.2",
  "request_id": "string",                  // Client-generated UUID
  "verb": "string",                        // From verb taxonomy
  "params": { ... },                       // Verb-specific parameters
  "options": {                             // OPTIONAL
    "timeout_ms": 0,
    "response_detail": "summary" | "full" | "raw"
  }
}
```

### 7.2 Response Envelope

```json
{
  "cap_version": "0.2",
  "request_id": "string",                  // Echo
  "verb": "string",                        // Echo
  "status": "success" | "error" | "partial",
  "result": { ... },                       // Verb-specific. See §6
  "provenance": { ... },                   // See §6.9. OPTIONAL (when requested)
  "error": {                               // Present only if status = "error"
    "code": "string",
    "message": "string",
    "suggestion": "string",
    "details": {}
  },
  "pagination": {                          // OPTIONAL. For list-type responses
    "total": 0,
    "offset": 0,
    "limit": 0,
    "has_more": true | false
  }
}
```

### 7.3 Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `node_not_found` | 404 | Node does not exist in graph |
| `verb_not_supported` | 501 | Server does not support this verb (or not at this conformance level) |
| `insufficient_tier` | 403 | Access tier too low for requested verb or detail level |
| `graph_stale` | 503 | Graph not updated within expected frequency |
| `computation_timeout` | 504 | Causal computation exceeded timeout |
| `invalid_intervention` | 422 | Intervention parameters invalid |
| `path_not_found` | 404 | No causal path exists between nodes |
| `rate_limited` | 429 | Rate limit exceeded |
| `subgraph_too_large` | 413 | Subgraph request exceeds max response size |
| `query_type_not_supported` | 400 | Server cannot perform the requested query_type (e.g., interventional at L1) |
| `insufficient_mechanism_coverage` | 422 | One or more target nodes require causal path nodes that lack executable structural mechanisms. Server cannot compute `scm_simulation` for these targets. |

---

## 8. Transport Bindings <a name="8-transport"></a>

**[NORMATIVE]**

CAP is transport-agnostic. The spec defines three bindings.

### 8.1 HTTP Binding (Primary)

```
POST {endpoint}/{verb_category}/{verb_name}
Content-Type: application/json
Authorization: Bearer {token} | X-CAP-Key: {key}

Body: CAP Request Envelope
```

Verb path uses dots-to-slashes: `intervene.do` → `POST {endpoint}/intervene/do`.

Capability Card: `GET {base}/.well-known/cap.json`

### 8.2 MCP Binding (Optional)

A CAP server MAY expose its verbs as MCP tools for use by MCP-compatible clients (Claude Code, Cursor, Windsurf, etc.).

Mapping convention:
- Verb `observe.predict` → MCP tool name `cap_observe_predict`
- All CAP verbs follow `cap_{category}_{name}` naming
- Input/output schemas are derived from the CAP verb schemas in §6
- MCP tool descriptions MUST include the CAP verb name and conformance level
- Transport: **stdio** (local) or **Streamable HTTP** (remote), following current MCP standard transports

MCP authorization, when supported, follows the optional OAuth 2.1 framework defined in the MCP specification. This is separate from CAP's own authentication defined in the Capability Card.

### 8.3 A2A Binding (Optional)

A CAP server MAY publish an A2A Agent Card to make itself discoverable by A2A-compatible orchestrators.

The Agent Card is served at `/.well-known/agent-card.json` (per A2A convention) and SHOULD include a CAP extension referencing the Capability Card:

```json
{
  "name": "Abel Causal Engine",
  "skills": [
    { "id": "causal_prediction", "name": "Causal Prediction (CAP L1)" },
    { "id": "causal_intervention", "name": "Intervention Simulation (CAP L2)" }
  ],
  "extensions": {
    "cap": {
      "capability_card_url": "https://cap.abel.ai/.well-known/cap.json",
      "conformance_level": 2
    }
  }
}
```

---

## 9. Security Model <a name="9-security"></a>

**[NORMATIVE]**

### 9.1 Authentication

CAP supports:
- **None**: Public servers with rate limiting only
- **API Key**: Via header (recommended: `X-CAP-Key`) or query parameter
- **OAuth 2.1**: For enterprise deployments

The authentication method is declared in the Capability Card. Servers MUST reject unauthenticated requests to verbs not available at the `public` access tier.

### 9.2 Progressive Disclosure

Causal graph topology is a high-value asset for many CAP server operators. The protocol defines a standard mechanism for controlling response detail:

| Response Detail | What's Included | What's Obfuscated/Hidden |
|----------------|-----------------|-------------------------|
| `summary` | Node names, direction, probability_positive | Weights, taus, CIs, paths |
| `full` | All of summary + obfuscated weights (e.g. quantile ranks 1-5) + taus + impact fractions | Raw coefficients, full subgraph topology |
| `raw` | Everything as computed | Nothing |

Servers MUST document their obfuscation approach via the `disclosure_policy` object in the Capability Card (see §4.1). Clients MUST NOT assume `weight` values are raw coefficients unless `response_detail = "raw"`.

### 9.3 Anti-Distillation Recommendations

**[INFORMATIVE]**

- Servers SHOULD limit edges returned per `traverse.subgraph` response (recommended: ≤50)
- Servers MAY monitor query patterns to detect systematic graph extraction
- Servers MAY watermark responses (e.g. varying decimal precision per client)
- These are operational recommendations, not protocol requirements

---

## 10. Conformance Levels <a name="10-conformance"></a>

**[NORMATIVE]**

### 10.1 Level 1: Observe

The minimum viable CAP server. Suitable for prediction services, Granger-causality systems, basic graph-based forecasters.

**Core verbs MUST implement**: `meta.capabilities`, `graph.neighbors`, `effect.query` (observational only)

**Convenience verbs SHOULD implement**: `observe.predict`, `traverse.parents`, `meta.health`

**Does NOT require**: `reasoning_mode`, `identification_status`, or `assumptions` in responses (since no interventional/counterfactual claims are made).

### 10.2 Level 2: Intervene

For engines that can simulate or estimate causal interventions. Requires honest disclosure of reasoning mode and assumptions.

**Core verbs MUST implement**: All Level 1 core verbs, plus `effect.query` (interventional mode), `graph.paths`

**Convenience verbs SHOULD implement**: `intervene.do`, `traverse.children`

**MUST** include in all `intervene.*` and `effect.query(interventional)` responses:
- `reasoning_mode` (from §5.1) — per-effect in `intervene.do` (see §6.6)
- `identification_status` (from §5.2)
- `assumptions` (from §5.3)

### 10.3 Level 3: Counterfact (Reserved)

Level 3 is defined in this spec for forward compatibility but is **not yet normative**. No conformance tests exist for Level 3 in v0.2.

Level 3 will require:
- Full structural causal model (SCM) with structural equations
- Exogenous noise inference (abduction step)
- `counterfact.query` and `counterfact.contrast` verb support
- `reasoning_mode` must be `scm_simulation` or `identified_causal_effect`

Servers MUST NOT declare `conformance_level: 3` under v0.2. This will be unlocked in a future spec version when normative requirements and conformance tests are finalized.

**Level 3 exit criteria** (all must be met before a future spec version unlocks L3):
1. Normative counterfactual request/response schemas finalized with explicit abduction-action-prediction semantics.
2. Conformance test suite available for counterfactual verification.
3. At least one implementation demonstrates abduction-action-prediction with disclosed residual assumptions.

Note: Servers with `causal_engine.structural_mechanisms.counterfactual_ready: true` are signaling technical readiness for Level 3 once the protocol unlocks it. This is a forward-looking capability signal, not a conformance claim.

### 10.4 Conformance Declaration

Servers declare their level in the Capability Card. Clients SHOULD check `conformance_level` before invoking level-gated verbs and MUST handle `verb_not_supported` / `query_type_not_supported` errors gracefully.

The `detailed_capabilities` object in the Capability Card provides granular information beyond the conformance level. Two Level 2 servers may have very different capabilities (one may handle latent confounders, the other may not). The conformance level is a coarse signal for agents; `detailed_capabilities` is for advanced clients and humans.

---

## 11. Relationship to MCP and A2A <a name="11-relationship"></a>

**[INFORMATIVE]**

### 11.1 Positioning

CAP is an **independent causal semantics layer** that can interoperate with both MCP and A2A but is not a subset or profile of either.

| Protocol | Scope | Relationship to CAP |
|----------|-------|-------------------|
| MCP | Agent ↔ Tools/Data | CAP verbs can be exposed as MCP tools via MCP binding. MCP can be used to fetch data that is then analyzed by a CAP server. |
| A2A | Agent ↔ Agent | CAP servers can be discovered via A2A Agent Cards. A2A orchestrators can delegate causal reasoning tasks to CAP servers. |
| CAP | Agent ↔ Causal Reasoning | Defines causal-specific semantics (verbs, assumptions, reasoning modes, capability cards) that neither MCP nor A2A natively express. |

CAP's value is not that it replaces MCP or A2A, but that it adds causal-specific semantics that would be awkward, incomplete, or unreliable to express through generic tool descriptions or task delegation protocols.

### 11.2 Composition Patterns

**Pattern 1: MCP for data, CAP for reasoning**
```
Agent → MCP (fetch market data from Bloomberg server)
      → CAP (analyze causal drivers of price move)
      → MCP (place trade via broker server)
```

**Pattern 2: A2A for delegation, CAP for fulfillment**
```
Orchestrator → A2A (discover causal agent via Agent Card)
             → A2A (delegate: "why is BTC pumping?")
             → CAP Server (fulfill via observe.predict + graph.neighbors)
             → A2A (return structured causal explanation)
```

**Pattern 3: CAP-native client**
```
Agent → CAP (intervene.do: "what if Fed hikes 50bps?")
      → CAP (graph.paths: show causal chain rates → equities)
```

### 11.3 Governance

CAP is currently authored and maintained by Abel AI. The protocol is published under Apache 2.0 and intended for open adoption. Contribution to AAIF or another standards body is a future possibility once the protocol has demonstrated multi-implementer adoption.

---

## 12. Extension Mechanism <a name="12-extensions"></a>

**[NORMATIVE]**

Domains can register extensions that add domain-specific node types, metadata, and verb parameters.

### 12.1 Extension Registration

Extensions are declared in the Capability Card under `extensions`:

```json
{
  "extensions": {
    "finance": {
      "schema_url": "https://causalagentprotocol.org/extensions/finance/v1.json",
      "node_types": ["asset_price", "macro_indicator", "volatility_index", "on_chain_metric"],
      "additional_params": {
        "observe.predict": {
          "asset_class_filter": "string"
        }
      }
    }
  }
}
```

### 12.2 Planned Extensions

| Domain | Status | Key Additions |
|--------|--------|--------------|
| **Finance** | v1 draft (Abel AI) | Asset class node types, trading pair formats |
| **Healthcare** | Planned | Treatment/outcome/biomarker types, study_design param, compliance flags |
| **Supply Chain** | Planned | Demand/inventory/logistics types, lead_time units |
| **Climate** | Planned | Forcing/feedback/tipping_point types, SSP scenario param |

---

## 13. Reference Implementation Guidance <a name="13-reference-impl"></a>

**[INFORMATIVE]**

### 13.1 For Implementers

To build a CAP-compliant server:

1. **Choose your conformance level** (start with Level 1 if uncertain).
2. **Implement core verbs** for your level: `meta.capabilities`, `graph.neighbors`, `effect.query`.
3. **Serve the Capability Card** at `/.well-known/cap.json`. Be honest in `detailed_capabilities`, `assumptions`, and `reasoning_modes_supported`.
4. **Add convenience verbs** that make sense for your engine.
5. **If Level 2**: Ensure all interventional responses include `reasoning_mode`, `identification_status`, `assumptions`.
6. **Optionally add MCP binding** for Claude Code / Cursor / Windsurf compatibility.
7. **Test against the conformance suite** (to be published).

### 13.2 Abel Reference Implementation

Abel AI publishes the first reference implementation:

- **Conformance Level 2** (observe + intervene; counterfactual NOT claimed)
- **Reasoning modes**: `scm_simulation` (when all solve-path nodes have fitted mechanisms) and `graph_propagation` (fallback when coverage is partial). Per-effect, per the Partial Coverage Rule (§6.6). Identification status is always `not_formally_identified` — mechanism override does not imply formal identification.
- **Structural mechanisms**: Linear and GBDT, fitted on PCMCI-discovered graph. ~420 of ~450 endogenous nodes covered. Mechanism override supported. Residuals computable (additive form). Counterfactual technically ready (L3 protocol-reserved).
- **Assumptions**: `causal_sufficiency`, `faithfulness`, `stationarity`, `no_instantaneous_effects`, `mechanism_invariance_under_intervention`
- **Finance domain extension** v1
- **TypeScript**, Streamable HTTP + stdio transports
- **Backed by**: PCMCI on H100 clusters, Neo4j graph backend
- **Repository**: `github.com/abel-ai/cap-reference` (planned)

### 13.3 Minimal Level 1 Example

A minimal CAP Level 1 server needs only three endpoints:

```
GET  /.well-known/cap.json          → Capability Card
POST /v1/meta/capabilities          → Same Capability Card (via CAP envelope)
POST /v1/graph/neighbors            → Return causal parents/children
POST /v1/effect/query               → Return observational prediction
```

`meta.capabilities` MUST return a semantically equivalent document to `/.well-known/cap.json`, wrapped in the standard CAP response envelope. Servers MUST NOT return divergent capability information between these two endpoints.

This is achievable in ~200 lines of Python or TypeScript.

### 13.4 Second Implementation Strategy

A protocol requires at least two independent implementations to be credible. Abel's strategy:

- **Technical validation**: causal-learn (UCSD, Biwei Huang) Level 1 server using PC/GES algorithms — demonstrates spec can be implemented against a different engine. Note: causal-learn shares a co-founder with Abel; this validates technical feasibility but not organizational independence.
- **Ecosystem signal**: An independent implementation from a separate organization (e.g., tigramite / Jakob Runge, DoWhy / Microsoft) — demonstrates genuine external adoption.

---

## Appendix A: Protocol Comparison <a name="appendix-a"></a>

**[INFORMATIVE]**

| Dimension | MCP | A2A | CAP |
|---|---|---|---|
| Created by | Anthropic (2024) | Google (Apr 2025) | Abel AI (2026) |
| Current governance | AAIF / Linux Foundation | Linux Foundation | Abel AI (AAIF contribution planned) |
| Primary role | Agent ↔ Tool | Agent ↔ Agent | Agent ↔ Causal Engine |
| Transport | stdio, Streamable HTTP (legacy: HTTP+SSE) | HTTP, SSE, webhooks | HTTP (primary), MCP binding, A2A binding |
| State model | Stateless tool calls + lifecycle management | Stateful task lifecycle | Stateless (v0.2) |
| Discovery | Server manifest | Agent Card at `/.well-known/agent-card.json` | Capability Card at `/.well-known/cap.json` |
| Unique concepts | Tools, Resources, Prompts | Task lifecycle, Agent Cards, Skills | Causal Verbs, Conformance Levels, Reasoning Modes, Assumption Disclosure |
| Auth | Optional OAuth 2.1 (for HTTP transport) | OAuth 2.0, PKCE, API keys | API keys, OAuth 2.1 + progressive disclosure tiers |
| Composable with CAP | CAP verbs as MCP tools | CAP servers as A2A agents | Native + MCP/A2A bindings |

---

## Appendix B: Glossary <a name="appendix-b"></a>

| Term | Definition |
|------|-----------|
| **CAP** | Causal Agent Protocol. This specification. |
| **Capability Card** | JSON document at `/.well-known/cap.json` describing a CAP server's capabilities, assumptions, graph coverage, and access tiers. |
| **Conformance Level** | L1 (Observe), L2 (Intervene). L3 (Counterfact) reserved for future spec. |
| **Core Verb** | A verb required for conformance at a given level. |
| **Convenience Verb** | A verb recommended for practical use but not required for conformance. |
| **Reasoning Mode** | How an interventional/counterfactual result was computed (§5.1). |
| **Identification Status** | Whether a causal estimand is formally identified (§5.2). |
| **do(X)** | Pearl's do-operator. Forces variable X to a specific value, severing all incoming causal edges, to simulate the effect of an intervention. |
| **Tau** | Time lag in a causal relationship. If A causes B with tau=2 at hourly resolution, A's change propagates to B after 2 hours. |
| **Provenance** | Metadata about how a causal result was computed: algorithm, graph version, computation method. |
| **Progressive Disclosure** | Access-tier-based control over how much graph detail is revealed per response. |
| **SCM** | Structural Causal Model. A set of equations defining causal mechanisms generating observed data. |
| **CPDAG** | Completed Partially Directed Acyclic Graph. An equivalence class of DAGs that encode the same conditional independencies. |
| **PAG** | Partial Ancestral Graph. Represents an equivalence class of causal structures that may include latent variables. |

---

## Appendix C: Canonical Enum Values <a name="appendix-c"></a>

**[NORMATIVE]**

### C.1 reasoning_mode

`identified_causal_effect` | `scm_simulation` | `graph_propagation` | `reduced_form_estimate` | `conditional_forecast` | `heuristic`

### C.2 identification_status

`identified` | `partially_identified` | `not_formally_identified` | `not_applicable`

### C.3 assumptions (non-exhaustive; servers MAY add custom values)

`causal_sufficiency` | `faithfulness` | `acyclicity` | `stationarity` | `linearity` | `no_instantaneous_effects` | `granger_predictive_causality_only` | `no_latent_confounders_addressed` | `homogeneity` | `positivity` | `consistency` | `no_interference` | `mechanism_invariance_under_intervention`

### C.4 causal_engine.family

`constraint-based` | `score-based` | `fcm` | `granger` | `hybrid` | `neural` | `scm` | `other`

### C.5 causal_engine.discovery_method

`conditional_independence` | `score_optimization` | `continuous_optimization` | `granger_regression` | `structural_equation_fitting` | `other`

### C.6 graph.edge_types_supported

`directed` | `directed_lagged` | `partially_oriented` | `bidirected` | `undirected`

### C.7 graph.graph_representation

`dag` | `cpdag` | `pag` | `time_lagged_dag` | `weighted_adjacency` | `other`

### C.8 uncertainty_methods_supported

`bootstrap` | `analytical` | `posterior` | `monte_carlo` | `none`

### C.9 interval_method

`bootstrap` | `analytical` | `posterior` | `none`

### C.10 structural_mechanisms.families

`linear` | `gbdt` | `neural` | `gam` | `polynomial` | `other`

### C.11 structural_mechanisms.residual_semantics

`additive` | `implicit` | `mixed`

### C.12 mechanism_family_used (provenance)

`linear` | `gbdt` | `neural` | `gam` | `none`

---

## Appendix D: Changelog from v0.1 <a name="appendix-d-changelog-from-v01"></a>

**[INFORMATIVE]**

### Breaking Changes

1. **Conformance Level 3 is now reserved, not implementable.** Servers MUST NOT declare `conformance_level: 3` under v0.2. L3 requires full SCM semantics that are not yet normatively specified. Counterfactual verbs remain defined for forward compatibility.

2. **Causal Semantics Model (§5) added.** All `intervene.*` and `counterfact.*` responses now MUST include `reasoning_mode`, `identification_status`, and `assumptions`. This is the most significant normative addition.

3. **Verb tier split: Core vs Convenience.** Conformance testing checks Core verbs only. See §6.1–6.2.

### Non-Breaking Changes

4. **Capability Card expanded.** New required fields: `cap_spec_version`, `detailed_capabilities`, `assumptions`, `reasoning_modes_supported`, `graph.edge_types_supported`, `graph.graph_representation`. New optional fields: `uncertainty_methods_supported`.

5. **Stateful sessions removed.** v0.2 is explicitly stateless. Session semantics may be added in future versions as an explicit extension.

6. **Positioning language updated.** "Third protocol layer" replaced with "independent causal semantics layer with HTTP/MCP/A2A bindings" throughout.

7. **Factual corrections.** A2A Agent Card path corrected to `/.well-known/agent-card.json`. MCP transport description updated to reflect stdio + Streamable HTTP as current standards, with legacy HTTP+SSE noted for backward compatibility. AAIF governance description made precise per December 2025 announcements.

8. **Normative/Informative markers added.** Each section now explicitly marked.

9. **Canonical enum values formalized.** Appendix C provides normative enum values for all key fields.

10. **Second implementation strategy documented.** §13.4 acknowledges the need for independent implementations and distinguishes technical validation from ecosystem signal.

11. **Granger service example added.** §4.3 demonstrates how a simple Granger-causality service honestly declares its limitations via Capability Card.

### v0.2.1 Patches (consensus from four-round adversarial review)

12. **A2A/AAIF governance statement corrected.** §1.1 now precisely states: MCP is under AAIF governance; A2A is a Linux Foundation project. Previous text incorrectly implied both were under AAIF.

13. **`handles_confounding` removed from `detailed_capabilities`.** This boolean was ambiguous (could mean 5+ different things). Existing fields `latent_confounding_modeled`, `effect_estimation`, and `intervention_simulation` provide more precise coverage.

14. **Assumptions override semantics formalized.** §5.3 now states: response-level `assumptions`, when present, MUST be interpreted as the complete effective assumption set for that response — not merged with Capability Card assumptions.

15. **`disclosure_policy` added to Capability Card.** New optional-but-recommended object providing machine-readable obfuscation policy (`weight_detail`, `path_detail`, `default_response_detail`). Resolves the gap where §9.2 required servers to document obfuscation but the Capability Card had no field for it.

16. **`graph.neighbors` CPDAG/PAG behavior specified.** Servers with `graph_representation: "cpdag"` or `"pag"` MUST return only orientation-determined neighbors. New optional response field `undetermined_neighbor_count` reports omitted ambiguous edges.

17. **`effect.query` Level 1 fallback specified.** L1 servers MUST return `query_type_not_supported` for interventional queries.

18. **`identified_causal_effect` meaning clarified.** Table entry in §5.1 now explicitly ties formal identification to the disclosed assumptions.

19. **`counterfact.*` verbs marked `(reserved in v0.2)`** throughout verb listings for visual clarity.

### v0.2.2 Patches (consensus from six-round adversarial review — structural mechanisms upgrade)

20. **`scm_simulation` definition rewritten with normative mechanism override semantics.** §5.1 now requires: explicit mechanisms, mechanism replacement under do(...), non-intervened mechanisms fixed, modified-system forward solve (temporal order for lagged systems). Explicitly states this label does not imply formal identification. Data-fitted mechanisms (linear, GBDT, neural) qualify if they implement proper do-operator semantics.

21. **`structural_mechanisms` object added to Capability Card.** New conditionally-required object under `causal_engine` — MUST be present with `available: true` and `mechanism_override_supported: true` when `reasoning_modes_supported` includes `scm_simulation`. Fields: `available`, `families`, `nodes_with_fitted_mechanisms`, `residuals_computable`, `residual_semantics`, `mechanism_override_supported`, `counterfactual_ready`.

22. **Claim-to-card binding rule added.** §5.1 normative rule: declaring `scm_simulation` without providing `structural_mechanisms` is a conformance violation.

23. **Partial Coverage Rule added to `intervene.do`.** §6.6 normative rule: `reasoning_mode: "scm_simulation"` MUST NOT be returned for any individual effect unless all nodes in the causal path to that target have executable mechanisms. Per-effect `reasoning_mode` and `mechanism_coverage_complete` fields added — in multi-target requests, different targets may have different reasoning modes depending on mechanism coverage. New error code `insufficient_mechanism_coverage` added.

24. **Per-effect `reasoning_mode` in `intervene.do` response.** `reasoning_mode` moved from result-level to per-effect level to support mixed-coverage multi-target requests. `identification_status` and `assumptions` remain at result level.

25. **Provenance expanded.** New optional fields: `mechanism_family_used`, `mechanism_model_version`.

26. **New canonical assumption: `mechanism_invariance_under_intervention`.** Core assumption for `scm_simulation`: non-intervened mechanisms remain invariant under intervention.

27. **Level 3 exit criteria added.** §10.3 now defines three conditions that must be met before a future spec version unlocks L3 conformance. Servers with `counterfactual_ready: true` are signaling technical readiness, not conformance.

28. **New canonical enums added.** Appendix C expanded: `structural_mechanisms.families`, `structural_mechanisms.residual_semantics`, `mechanism_family_used`.

### v0.2.2 Errata (internal consistency fixes from final review)

29. **`structural_mechanisms` nesting unified.** Schema, examples, and changelog now consistently place `structural_mechanisms` as a nested object within `causal_engine`, not a top-level Capability Card field. Claim-to-card binding updated to reference `causal_engine.structural_mechanisms`.

30. **Abel example and §13.2 reference implementation aligned.** Both now consistently show Abel as supporting `scm_simulation` (when mechanism coverage is complete) and `graph_propagation` (as fallback), with `not_formally_identified` identification status in both cases.

31. **`meta.capabilities` equivalence rule added.** §13.3 now states: `meta.capabilities` MUST return a semantically equivalent document to `/.well-known/cap.json`.

32. **`$schema` URL updated** to `v0.2.2.json` to match spec version.

---

*End of CAP Protocol Specification v0.2.2-draft*
