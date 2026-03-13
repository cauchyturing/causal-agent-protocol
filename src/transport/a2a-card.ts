// src/transport/a2a-card.ts
//
// §8.3 A2A Binding — serves /.well-known/agent-card.json
// Describes this CAP server as a Google A2A protocol agent.

import type { Express, Request, Response } from "express";
import type { Config } from "../config.js";
import { getToolDefinitions } from "./mcp-binding.js";

/**
 * Build the A2A Agent Card object.
 */
export function buildA2ACard(endpoint: string): Record<string, unknown> {
  const tools = getToolDefinitions();

  const skills = tools.map((t) => ({
    id: t.verb,
    name: t.name,
    description: t.description,
    tags: [t.level, t.verb.split(".")[0]],
  }));

  return {
    name: "Abel Social Physical Engine",
    description:
      "CAP v0.2.2 Level 2 causal reasoning server backed by PCMCI on H100s + Neo4j. " +
      "Supports observational and interventional causal queries over a live financial causal graph.",
    url: endpoint,
    version: "0.1.0",
    provider: {
      organization: "Abel AI",
      url: "https://abel.ai",
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    authentication: {
      schemes: ["bearer", "apiKey"],
      credentials: "API key via X-CAP-Key header or Authorization: Bearer token",
    },
    // §8.3: CAP extension referencing Capability Card
    extensions: {
      cap: {
        capability_card_url: `${endpoint}/.well-known/cap.json`,
        conformance_level: 2,
      },
    },
    skills,
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
  };
}

/**
 * Mount the /.well-known/agent-card.json route on an Express app.
 */
export function serveA2ARoute(app: Express, config: Config): void {
  app.get("/.well-known/agent-card.json", (_req: Request, res: Response) => {
    const endpoint = config.publicUrl ?? `http://localhost:${config.port}`;
    const card = buildA2ACard(endpoint);
    res.json(card);
  });
}
