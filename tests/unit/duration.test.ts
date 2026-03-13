import { describe, it, expect } from "vitest";
import { hoursToISO, tauToISO } from "../../src/utils/duration.js";

describe("hoursToISO", () => {
  it("converts positive hours to ISO 8601", () => {
    expect(hoursToISO(1)).toBe("PT1H");
    expect(hoursToISO(24)).toBe("PT24H");
  });

  it("returns PT0H for zero", () => {
    expect(hoursToISO(0)).toBe("PT0H");
  });

  it("returns PT0H for negative values", () => {
    expect(hoursToISO(-1)).toBe("PT0H");
    expect(hoursToISO(-100)).toBe("PT0H");
  });
});

describe("tauToISO", () => {
  it("converts tau with default 1H resolution", () => {
    expect(tauToISO(2)).toBe("PT2H");
    expect(tauToISO(1)).toBe("PT1H");
  });

  it("converts tau with custom resolution", () => {
    expect(tauToISO(3, 4)).toBe("PT12H");
  });

  it("handles tau=0", () => {
    expect(tauToISO(0)).toBe("PT0H");
  });

  it("handles negative tau (clamps to PT0H)", () => {
    expect(tauToISO(-1)).toBe("PT0H");
  });
});
