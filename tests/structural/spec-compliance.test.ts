/**
 * Structural Test: Spec Compliance — CAP v0.2.2
 *
 * Verifies that code artifacts match specific normative claims from the spec.
 * Each test references its spec section. If the spec changes, update here.
 */

import { describe, it, expect } from "vitest";
import { CAP_ERROR_CODES } from "../../src/cap/errors.js";
import { buildCapabilityCard } from "../../src/cap/capability-card.js";

// ── §7.3 Error Codes ─────────────────────────────────────────

describe("Error codes match §7.3", () => {
  // Spec §7.3 defines exactly these 11 error codes with HTTP statuses
  const specErrorCodes: Record<string, number> = {
    node_not_found: 404,
    verb_not_supported: 501,
    insufficient_tier: 403,
    graph_stale: 503,
    computation_timeout: 504,
    invalid_intervention: 422,
    path_not_found: 404,
    rate_limited: 429,
    subgraph_too_large: 413,
    query_type_not_supported: 400,
    insufficient_mechanism_coverage: 422,
  };

  it("every §7.3 error code is present with correct HTTP status", () => {
    for (const [code, expectedHttp] of Object.entries(specErrorCodes)) {
      const entry = CAP_ERROR_CODES[code as keyof typeof CAP_ERROR_CODES];
      expect(entry, `Missing error code '${code}'`).toBeDefined();
      expect(entry.http, `Wrong HTTP status for '${code}'`).toBe(expectedHttp);
    }
  });

  it("no spec error codes are missing (count check)", () => {
    const specCodes = Object.keys(specErrorCodes);
    const codeCodes = Object.keys(CAP_ERROR_CODES);
    for (const code of specCodes) {
      expect(codeCodes).toContain(code);
    }
  });
});

// ── §4 Capability Card Structure ──────────────────────────────

describe("Capability Card matches §4 required fields", () => {
  const card = buildCapabilityCard("https://test.example.com");

  it("has all required top-level fields (§4.1)", () => {
    const requiredFields = [
      "$schema",
      "name",
      "description",
      "version",
      "cap_spec_version",
      "provider",
      "endpoint",
      "conformance_level",
      "supported_verbs",
      "causal_engine",
      "detailed_capabilities",
      "assumptions",
      "reasoning_modes_supported",
      "graph",
      "authentication",
    ];
    for (const field of requiredFields) {
      expect(card, `Missing required field '${field}'`).toHaveProperty(field);
    }
  });

  it("causal_engine has all 7 required subfields (§4.1)", () => {
    const requiredSubfields = [
      "family",
      "algorithm",
      "discovery_method",
      "supports_time_lag",
      "supports_latent_variables",
      "supports_nonlinear",
      "supports_instantaneous",
    ];
    for (const field of requiredSubfields) {
      expect(card.causal_engine, `Missing causal_engine.${field}`).toHaveProperty(field);
    }
  });

  it("structural_mechanisms has all 7 fields (§4.1, required when scm_simulation declared)", () => {
    const sm = card.causal_engine.structural_mechanisms;
    expect(sm).toBeDefined();
    const requiredFields = [
      "available",
      "families",
      "nodes_with_fitted_mechanisms",
      "residuals_computable",
      "residual_semantics",
      "mechanism_override_supported",
      "counterfactual_ready",
    ];
    for (const field of requiredFields) {
      expect(sm, `Missing structural_mechanisms.${field}`).toHaveProperty(field);
    }
  });

  it("detailed_capabilities has exactly 9 boolean fields (§4.1)", () => {
    const requiredBooleans = [
      "graph_discovery",
      "graph_traversal",
      "temporal_multi_lag",
      "effect_estimation",
      "intervention_simulation",
      "counterfactual_scm",
      "latent_confounding_modeled",
      "partial_identification",
      "uncertainty_quantified",
    ];
    for (const field of requiredBooleans) {
      expect(card.detailed_capabilities, `Missing detailed_capabilities.${field}`).toHaveProperty(field);
      expect(typeof (card.detailed_capabilities as Record<string, unknown>)[field]).toBe("boolean");
    }
    expect(Object.keys(card.detailed_capabilities)).toHaveLength(9);
  });

  it("graph has all 9 required subfields (§4.1)", () => {
    const requiredSubfields = [
      "domains",
      "node_count",
      "edge_count",
      "node_types",
      "edge_types_supported",
      "graph_representation",
      "update_frequency",
      "temporal_resolution",
      "coverage_description",
    ];
    for (const field of requiredSubfields) {
      expect(card.graph, `Missing graph.${field}`).toHaveProperty(field);
    }
  });
});
