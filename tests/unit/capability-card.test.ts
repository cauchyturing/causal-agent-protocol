import { describe, it, expect } from "vitest";
import { buildCapabilityCard } from "../../src/cap/capability-card.js";

describe("buildCapabilityCard", () => {
  const card = buildCapabilityCard("https://example.com");

  it("conformance_level MUST NOT be 3 (reserved)", () => {
    expect(card.conformance_level).not.toBe(3);
    expect(card.conformance_level).toBe(2);
  });

  it("cap_spec_version is 0.2.2", () => {
    expect(card.cap_spec_version).toBe("0.2.2");
  });

  it("includes $schema URL", () => {
    expect(card.$schema).toContain("v0.2.2");
  });

  it("structural_mechanisms.available and mechanism_override_supported are true", () => {
    expect(card.causal_engine.structural_mechanisms.available).toBe(true);
    expect(card.causal_engine.structural_mechanisms.mechanism_override_supported).toBe(true);
  });

  it("reasoning_modes_supported includes scm_simulation and graph_propagation", () => {
    expect(card.reasoning_modes_supported).toContain("scm_simulation");
    expect(card.reasoning_modes_supported).toContain("graph_propagation");
  });

  it("assumptions match l2-semantics ABEL_ASSUMPTIONS", () => {
    expect(card.assumptions).toContain("causal_sufficiency");
    expect(card.assumptions).toContain("faithfulness");
    expect(card.assumptions).toContain("mechanism_invariance_under_intervention");
  });

  it("uses the provided endpoint", () => {
    expect(card.endpoint).toBe("https://example.com");
  });

  it("supported_verbs has core and convenience arrays", () => {
    expect(Array.isArray(card.supported_verbs.core)).toBe(true);
    expect(Array.isArray(card.supported_verbs.convenience)).toBe(true);
    expect(card.supported_verbs.core.length).toBeGreaterThan(0);
    expect(card.supported_verbs.convenience.length).toBeGreaterThan(0);
  });

  it("access_tiers define public, standard, enterprise", () => {
    const tiers = card.access_tiers.map(
      (t: { tier: string }) => t.tier
    );
    expect(tiers).toContain("public");
    expect(tiers).toContain("standard");
    expect(tiers).toContain("enterprise");
  });
});
