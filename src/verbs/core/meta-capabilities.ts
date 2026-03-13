import type { VerbHandler } from "../handler.js";
import { buildCapabilityCard } from "../../cap/capability-card.js";

export const metaCapabilitiesHandler: VerbHandler = {
  verb: "meta.capabilities",
  handle: async (_params, _client, config) => {
    // §13.3: endpoint MUST match /.well-known/cap.json (no /v1 suffix)
    const endpoint = config.publicUrl ?? `http://localhost:${config.port}`;
    const card = buildCapabilityCard(endpoint);
    return { result: card as unknown as Record<string, unknown> };
  },
};
