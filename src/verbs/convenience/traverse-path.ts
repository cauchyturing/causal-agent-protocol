import type { VerbHandler } from "../handler.js";
import { graphPathsHandler } from "../core/graph-paths.js";

export const traversePathHandler: VerbHandler = {
  verb: "traverse.path",
  handle: async (params, client, config) => {
    return graphPathsHandler.handle(params, client, config);
  },
};
