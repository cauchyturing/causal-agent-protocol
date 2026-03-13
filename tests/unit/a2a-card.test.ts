// tests/unit/a2a-card.test.ts
import { describe, it, expect } from "vitest";
import { buildA2ACard } from "../../src/transport/a2a-card.js";

describe("A2A Agent Card (§8.3)", () => {
  const card = buildA2ACard("http://localhost:3001");

  it("includes name matching CAP Capability Card", () => {
    expect(card["name"]).toBe("Abel Social Physical Engine");
  });

  it("includes description", () => {
    expect(typeof card["description"]).toBe("string");
    expect((card["description"] as string).length).toBeGreaterThan(0);
  });

  it("includes url pointing to the server endpoint", () => {
    expect(card["url"]).toBe("http://localhost:3001");
  });

  it("includes provider info", () => {
    const provider = card["provider"] as Record<string, unknown>;
    expect(provider).toBeDefined();
    expect(provider["organization"]).toBe("Abel AI");
  });

  it("includes version", () => {
    expect(card["version"]).toBeDefined();
  });

  it("includes capabilities.streaming = false", () => {
    const capabilities = card["capabilities"] as Record<string, unknown>;
    expect(capabilities["streaming"]).toBe(false);
  });

  it("includes skills listing CAP verbs", () => {
    const skills = card["skills"] as Array<Record<string, unknown>>;
    expect(skills.length).toBeGreaterThan(0);
    const skillIds = skills.map((s) => s["id"]);
    expect(skillIds).toContain("meta.capabilities");
    expect(skillIds).toContain("graph.neighbors");
    expect(skillIds).toContain("effect.query");
    expect(skillIds).toContain("observe.predict");
  });

  it("includes authentication schemes", () => {
    const auth = card["authentication"] as Record<string, unknown>;
    expect(auth["schemes"]).toBeDefined();
    const schemes = auth["schemes"] as string[];
    expect(schemes).toContain("bearer");
    expect(schemes).toContain("apiKey");
  });
});
