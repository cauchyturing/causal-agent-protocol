import { describe, it, expect } from "vitest";
import type { AbelClient } from "../../src/abel-client/client.js";
import type { Config } from "../../src/config.js";
import { type VerbHandler, createDispatcher } from "../../src/verbs/handler.js";

describe("createDispatcher", () => {
  const mockHandler: VerbHandler = {
    verb: "test.echo",
    handle: async (params) => ({
      result: { echo: params["msg"] },
    }),
  };

  const dispatch = createDispatcher([mockHandler]);

  it("routes to correct handler", async () => {
    const result = await dispatch(
      "test.echo",
      { msg: "hello" },
      {} as unknown as AbelClient,
      {} as unknown as Config
    );
    expect(result.result["echo"]).toBe("hello");
  });

  it("throws CAPError for unknown verb", async () => {
    const { CAPError } = await import("../../src/cap/errors.js");
    await expect(
      dispatch("unknown.verb", {}, {} as unknown as AbelClient, {} as unknown as Config)
    ).rejects.toSatisfy(
      (err: unknown) => err instanceof CAPError && err.code === "verb_not_supported"
    );
  });
});
