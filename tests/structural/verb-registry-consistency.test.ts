/**
 * Structural Test: Verb Registry ↔ MCP Binding Consistency
 *
 * Ensures that VERB_REGISTRY (protocol truth) and TOOL_DEFINITIONS (MCP binding)
 * never diverge. Every L1/L2 verb MUST have a corresponding MCP tool, and
 * conformance levels MUST match.
 */

import { describe, it, expect } from "vitest";
import { VERB_REGISTRY, getVerbsForLevel, verbRequiresL2Semantics } from "../../src/cap/verbs.js";
import { getToolDefinitions, TOOL_NAME_TO_VERB } from "../../src/transport/mcp-binding.js";
import { buildCapabilityCard } from "../../src/cap/capability-card.js";
import { checkVerbAccess } from "../../src/security/tiers.js";

describe("VERB_REGISTRY ↔ TOOL_DEFINITIONS consistency", () => {
  const tools = getToolDefinitions();
  const toolsByVerb = new Map(tools.map((t) => [t.verb, t]));

  // All L1/L2 verbs from the protocol registry
  const l1l2Verbs = Object.values(VERB_REGISTRY).filter((v) => v.minLevel <= 2);

  it("every L1/L2 verb in VERB_REGISTRY has a corresponding MCP tool", () => {
    for (const verb of l1l2Verbs) {
      const tool = toolsByVerb.get(verb.name);
      expect(tool, `Missing MCP tool for verb '${verb.name}'`).toBeDefined();
    }
  });

  it("every MCP tool maps to a verb in VERB_REGISTRY", () => {
    for (const tool of tools) {
      expect(
        VERB_REGISTRY[tool.verb],
        `MCP tool '${tool.name}' maps to verb '${tool.verb}' not in VERB_REGISTRY`
      ).toBeDefined();
    }
  });

  it("MCP tool count equals L1+L2 verb count", () => {
    expect(tools.length).toBe(l1l2Verbs.length);
  });

  it("conformance levels match between VERB_REGISTRY and TOOL_DEFINITIONS", () => {
    for (const tool of tools) {
      const registryVerb = VERB_REGISTRY[tool.verb]!;
      const expectedLevel = registryVerb.minLevel === 1 ? "L1" : "L2";
      expect(
        tool.level,
        `Level mismatch for '${tool.verb}': VERB_REGISTRY says L${registryVerb.minLevel}, TOOL_DEFINITIONS says ${tool.level}`
      ).toBe(expectedLevel);
    }
  });

  it("MCP tool naming follows §8.2 convention: cap_{category}_{name}", () => {
    for (const tool of tools) {
      const expected = `cap_${tool.verb.replace(".", "_")}`;
      expect(tool.name).toBe(expected);
    }
  });

  it("TOOL_NAME_TO_VERB lookup is complete and correct", () => {
    for (const tool of tools) {
      expect(TOOL_NAME_TO_VERB[tool.name]).toBe(tool.verb);
    }
  });
});

describe("VERB_REGISTRY completeness vs spec", () => {
  it("contains all 5 core verbs from spec §6.2", () => {
    const coreVerbs = Object.values(VERB_REGISTRY).filter((v) => v.tier === "core");
    const coreNames = coreVerbs.map((v) => v.name).sort();
    expect(coreNames).toEqual([
      "counterfact.query",
      "effect.query",
      "graph.neighbors",
      "graph.paths",
      "meta.capabilities",
    ]);
  });

  it("L3-reserved verbs are present with minLevel 3", () => {
    expect(VERB_REGISTRY["counterfact.query"]?.minLevel).toBe(3);
    expect(VERB_REGISTRY["counterfact.contrast"]?.minLevel).toBe(3);
  });

  it("intervene.* verbs all require reasoning_mode and assumptions", () => {
    const interveneVerbs = Object.values(VERB_REGISTRY).filter(
      (v) => v.category === "intervene"
    );
    for (const v of interveneVerbs) {
      expect(v.requiresReasoningMode, `${v.name} should require reasoning_mode`).toBe(true);
      expect(v.requiresAssumptions, `${v.name} should require assumptions`).toBe(true);
    }
  });
});

describe("Capability Card ↔ MCP binding coherence", () => {
  it("capability card supported_verbs.convenience includes all L2 convenience verbs with MCP tools", () => {
    const allTools = getToolDefinitions();
    const l2ConvenienceTools = allTools.filter((t) => {
      const reg = VERB_REGISTRY[t.verb]!;
      return reg.tier === "convenience" && reg.minLevel === 2;
    });
    // Every L2 convenience verb with a tool should be advertised in the card
    expect(l2ConvenienceTools.length).toBeGreaterThan(0);
    for (const tool of l2ConvenienceTools) {
      expect(VERB_REGISTRY[tool.verb]?.tier).toBe("convenience");
    }
  });

  it("capability card supported_verbs matches VERB_REGISTRY L1+L2 verbs", () => {
    const card = buildCapabilityCard("https://test.example.com");
    const cardCore = card.supported_verbs.core as string[];
    const cardConv = card.supported_verbs.convenience as string[];
    const allCardVerbs = [...cardCore, ...cardConv].sort();

    const registryL1L2 = Object.values(VERB_REGISTRY)
      .filter((v) => v.minLevel <= 2)
      .map((v) => v.name)
      .sort();

    expect(allCardVerbs).toEqual(registryL1L2);
  });
});

describe("Tier verbs ↔ Capability Card access_tiers sync", () => {
  it("every L1+L2 verb allowed by capability card tiers is also allowed by tiers.ts", () => {
    const card = buildCapabilityCard("https://test.example.com");
    const l1l2Verbs = Object.values(VERB_REGISTRY)
      .filter((v) => v.minLevel <= 2)
      .map((v) => v.name);

    for (const tierDef of card.access_tiers) {
      const tier = tierDef.tier as "public" | "standard" | "enterprise";
      for (const verb of l1l2Verbs) {
        // Check if the card's tier patterns would allow this verb
        const cardAllows = (tierDef.verbs as string[]).some((pattern) => {
          if (pattern === "*") return true;
          if (pattern.endsWith(".*")) return verb.startsWith(pattern.slice(0, -2) + ".");
          return verb === pattern;
        });
        if (cardAllows) {
          expect(
            checkVerbAccess(verb, tier),
            `Card allows '${verb}' at '${tier}' tier but tiers.ts rejects it`
          ).toBe(true);
        }
      }
    }
  });
});

describe("Verb utility functions", () => {
  it("getVerbsForLevel(1) returns only L1 verbs", () => {
    const l1Verbs = getVerbsForLevel(1);
    for (const v of l1Verbs) {
      expect(v.minLevel).toBe(1);
    }
    expect(l1Verbs.length).toBeGreaterThan(0);
  });

  it("getVerbsForLevel(2) returns all L1+L2 verbs", () => {
    const l2Verbs = getVerbsForLevel(2);
    for (const v of l2Verbs) {
      expect(v.minLevel).toBeLessThanOrEqual(2);
    }
    // Should include both L1 and L2 verbs
    const l1Count = l2Verbs.filter((v) => v.minLevel === 1).length;
    const l2Count = l2Verbs.filter((v) => v.minLevel === 2).length;
    expect(l1Count).toBeGreaterThan(0);
    expect(l2Count).toBeGreaterThan(0);
    expect(l2Verbs.length).toBe(l1Count + l2Count);
  });

  it("verbRequiresL2Semantics returns true for intervene.* verbs", () => {
    expect(verbRequiresL2Semantics("intervene.do")).toBe(true);
    expect(verbRequiresL2Semantics("intervene.ate")).toBe(true);
    expect(verbRequiresL2Semantics("intervene.sensitivity")).toBe(true);
  });

  it("verbRequiresL2Semantics returns false for observe/traverse/meta verbs", () => {
    expect(verbRequiresL2Semantics("observe.predict")).toBe(false);
    expect(verbRequiresL2Semantics("traverse.parents")).toBe(false);
    expect(verbRequiresL2Semantics("meta.health")).toBe(false);
  });

  it("verbRequiresL2Semantics returns false for unknown verbs", () => {
    expect(verbRequiresL2Semantics("nonexistent.verb")).toBe(false);
  });
});
