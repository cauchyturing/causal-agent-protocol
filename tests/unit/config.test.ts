import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("parses valid config from env vars", async () => {
    process.env["CAP_ENDPOINT"] = "https://api.example.com";
    process.env["CAP_API_KEY"] = "test-key";
    process.env["CAP_PORT"] = "4000";
    process.env["CAP_ACCESS_TIER"] = "enterprise";

    const { loadConfig } = await import("../../src/config.js");
    const config = loadConfig();

    expect(config.capEndpoint).toBe("https://api.example.com");
    expect(config.capApiKey).toBe("test-key");
    expect(config.port).toBe(4000);
    expect(config.accessTier).toBe("enterprise");
  });

  it("throws on missing CAP_ENDPOINT", async () => {
    process.env["CAP_ENDPOINT"] = undefined;

    const { loadConfig } = await import("../../src/config.js");
    expect(() => loadConfig()).toThrow();
  });

  it("uses defaults when optional vars are absent", async () => {
    process.env["CAP_ENDPOINT"] = "https://api.example.com";

    const { loadConfig } = await import("../../src/config.js");
    const config = loadConfig();

    expect(config.port).toBe(3001);
    expect(config.accessTier).toBe("standard");
    expect(config.capApiKey).toBeUndefined();
    expect(config.publicUrl).toBeUndefined();
    expect(config.rateLimitPublic).toBe(100);
  });

  it("parses CAP_PUBLIC_URL when provided", async () => {
    process.env["CAP_ENDPOINT"] = "https://api.example.com";
    process.env["CAP_PUBLIC_URL"] = "https://cap.example.com";

    const { loadConfig } = await import("../../src/config.js");
    const config = loadConfig();

    expect(config.publicUrl).toBe("https://cap.example.com");
  });
});
