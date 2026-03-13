import type { VerbHandler } from "../handler.js";
import { buildCapabilityCard } from "../../cap/capability-card.js";

export const metaCapabilitiesHandler: VerbHandler = {
  verb: "meta.capabilities",
  handle: async (_params, _client, config) => {
    const endpoint = `http://localhost:${config.port}/v1`;
    const card = buildCapabilityCard(endpoint);
    return { result: card as unknown as Record<string, unknown> };
  },
};
