import { describe, it, expect } from "vitest";
import {
  CAP_VERSION,
  RequestEnvelopeSchema,
  buildSuccessResponse,
  buildErrorResponse,
} from "../../src/cap/envelope.js";
import { CAPError } from "../../src/cap/errors.js";

describe("envelope", () => {
  describe("RequestEnvelopeSchema", () => {
    it("parses valid request", () => {
      const result = RequestEnvelopeSchema.parse({
        cap_version: "0.2",
        request_id: "550e8400-e29b-41d4-a716-446655440000",
        verb: "observe.predict",
        params: { target: "BTC" },
      });
      expect(result.verb).toBe("observe.predict");
    });

    it("rejects wrong cap_version", () => {
      expect(() =>
        RequestEnvelopeSchema.parse({
          cap_version: "0.1",
          request_id: "550e8400-e29b-41d4-a716-446655440000",
          verb: "observe.predict",
          params: {},
        })
      ).toThrow();
    });

    it("rejects non-uuid request_id", () => {
      expect(() =>
        RequestEnvelopeSchema.parse({
          cap_version: "0.2",
          request_id: "not-a-uuid",
          verb: "observe.predict",
          params: {},
        })
      ).toThrow();
    });

    it("accepts optional response_detail", () => {
      const result = RequestEnvelopeSchema.parse({
        cap_version: "0.2",
        request_id: "550e8400-e29b-41d4-a716-446655440000",
        verb: "observe.predict",
        params: {},
        options: { response_detail: "full" },
      });
      expect(result.options?.response_detail).toBe("full");
    });
  });

  describe("buildSuccessResponse", () => {
    it("constructs valid success envelope", () => {
      const resp = buildSuccessResponse("req-123", "observe.predict", {
        target: "BTC",
        prediction: { value: 0.02 },
      });
      expect(resp.cap_version).toBe(CAP_VERSION);
      expect(resp.status).toBe("success");
      expect(resp.request_id).toBe("req-123");
      expect(resp.verb).toBe("observe.predict");
      expect(resp.result?.target).toBe("BTC");
      expect(resp.error).toBeUndefined();
    });

    it("includes provenance when provided", () => {
      const resp = buildSuccessResponse(
        "req-123",
        "observe.predict",
        { target: "BTC" },
        { algorithm: "PCMCI" }
      );
      expect(resp.provenance?.algorithm).toBe("PCMCI");
    });
  });

  describe("buildErrorResponse", () => {
    it("constructs valid error envelope", () => {
      const err = new CAPError("node_not_found", {
        suggestion: "Check available tickers via meta.graph_info",
      });
      const resp = buildErrorResponse("req-123", "observe.predict", err);
      expect(resp.status).toBe("error");
      expect(resp.error?.code).toBe("node_not_found");
      expect(resp.error?.suggestion).toContain("meta.graph_info");
      expect(resp.result).toBeUndefined();
    });
  });
});
