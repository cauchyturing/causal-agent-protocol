// tests/unit/tiers.test.ts
import { describe, it, expect } from "vitest";
import {
  checkVerbAccess,
  getResponseDetail,
  matchesVerbPattern,
} from "../../src/security/tiers.js";

describe("matchesVerbPattern", () => {
  it("exact match", () => {
    expect(matchesVerbPattern("observe.predict", "observe.predict")).toBe(true);
  });

  it("wildcard category match", () => {
    expect(matchesVerbPattern("meta.health", "meta.*")).toBe(true);
    expect(matchesVerbPattern("meta.graph_info", "meta.*")).toBe(true);
  });

  it("star matches everything", () => {
    expect(matchesVerbPattern("intervene.do", "*")).toBe(true);
  });

  it("rejects non-matching", () => {
    expect(matchesVerbPattern("graph.neighbors", "observe.*")).toBe(false);
    expect(matchesVerbPattern("intervene.do", "observe.predict")).toBe(false);
  });
});

describe("checkVerbAccess", () => {
  it("public tier allows observe.predict", () => {
    expect(checkVerbAccess("observe.predict", "public")).toBe(true);
  });

  it("public tier allows meta.health (meta.* pattern)", () => {
    expect(checkVerbAccess("meta.health", "public")).toBe(true);
  });

  it("public tier rejects graph.neighbors", () => {
    expect(checkVerbAccess("graph.neighbors", "public")).toBe(false);
  });

  it("public tier rejects intervene.do", () => {
    expect(checkVerbAccess("intervene.do", "public")).toBe(false);
  });

  it("standard tier allows observe.*", () => {
    expect(checkVerbAccess("observe.predict", "standard")).toBe(true);
    expect(checkVerbAccess("observe.predict_multistep", "standard")).toBe(true);
    expect(checkVerbAccess("observe.attribute", "standard")).toBe(true);
  });

  it("standard tier allows intervene.do", () => {
    expect(checkVerbAccess("intervene.do", "standard")).toBe(true);
  });

  it("standard tier allows intervene.ate (intervene.* pattern)", () => {
    expect(checkVerbAccess("intervene.ate", "standard")).toBe(true);
  });

  it("standard tier allows intervene.sensitivity (intervene.* pattern)", () => {
    expect(checkVerbAccess("intervene.sensitivity", "standard")).toBe(true);
  });

  it("standard tier allows graph.paths (graph.* pattern)", () => {
    expect(checkVerbAccess("graph.paths", "standard")).toBe(true);
  });

  it("standard tier allows graph.neighbors (graph.* pattern)", () => {
    expect(checkVerbAccess("graph.neighbors", "standard")).toBe(true);
  });

  it("standard tier allows effect.query (effect.* pattern)", () => {
    expect(checkVerbAccess("effect.query", "standard")).toBe(true);
  });

  it("public tier rejects effect.query", () => {
    expect(checkVerbAccess("effect.query", "public")).toBe(false);
  });

  it("standard tier allows traverse.path (traverse.* pattern)", () => {
    expect(checkVerbAccess("traverse.path", "standard")).toBe(true);
  });

  it("enterprise tier allows everything", () => {
    expect(checkVerbAccess("graph.paths", "enterprise")).toBe(true);
    expect(checkVerbAccess("effect.query", "enterprise")).toBe(true);
    expect(checkVerbAccess("intervene.sensitivity", "enterprise")).toBe(true);
  });
});

describe("getResponseDetail", () => {
  it("public → summary", () => {
    expect(getResponseDetail("public")).toBe("summary");
  });

  it("standard → full", () => {
    expect(getResponseDetail("standard")).toBe("full");
  });

  it("enterprise → raw", () => {
    expect(getResponseDetail("enterprise")).toBe("raw");
  });
});
