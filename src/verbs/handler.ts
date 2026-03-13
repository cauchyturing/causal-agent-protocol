import type { AbelClient } from "../abel-client/client.js";
import type { Config } from "../config.js";
import type { ProvenanceInput } from "../cap/provenance.js";
import { CAPError } from "../cap/errors.js";

export interface VerbResult {
  result: Record<string, unknown>;
  provenance?: ProvenanceInput;
}

export interface VerbHandler {
  verb: string;
  handle(
    params: Record<string, unknown>,
    client: AbelClient,
    config: Config
  ): Promise<VerbResult>;
}

export type Dispatcher = (
  verb: string,
  params: Record<string, unknown>,
  client: AbelClient,
  config: Config
) => Promise<VerbResult>;

export function createDispatcher(handlers: VerbHandler[]): Dispatcher {
  const map = new Map<string, VerbHandler>();
  for (const h of handlers) {
    map.set(h.verb, h);
  }

  return async (verb, params, client, config) => {
    const handler = map.get(verb);
    if (!handler) {
      throw new CAPError("verb_not_supported", {
        suggestion: `Use meta.capabilities to discover supported verbs`,
      });
    }
    return handler.handle(params, client, config);
  };
}
