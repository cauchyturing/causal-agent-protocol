// tests/unit/rate-limiter.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../../src/security/rate-limiter.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests within limit", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 5; i++) {
      expect(limiter.check("client1", 10)).toBe(true);
      limiter.record("client1");
    }
  });

  it("rejects requests beyond limit", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      limiter.record("client1");
    }
    expect(limiter.check("client1", 10)).toBe(false);
  });

  it("resets after window expires", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      limiter.record("client1");
    }
    expect(limiter.check("client1", 10)).toBe(false);

    // Advance 1 hour
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(limiter.check("client1", 10)).toBe(true);
  });

  it("tracks clients independently", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      limiter.record("client1");
    }
    expect(limiter.check("client1", 10)).toBe(false);
    expect(limiter.check("client2", 10)).toBe(true);
  });

  it("returns remaining count", () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 3; i++) {
      limiter.record("client1");
    }
    expect(limiter.remaining("client1", 10)).toBe(7);
  });
});
