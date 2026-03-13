import { z } from "zod";

const AccessTierSchema = z.enum(["public", "standard", "enterprise"]);
const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const ConfigSchema = z.object({
  // CAP backend endpoint (the Python CAP server)
  capEndpoint: z.string().url(),
  // API key for the CAP backend
  capApiKey: z.string().optional(),
  // Access tier for this bridge's MCP clients
  accessTier: AccessTierSchema.default("standard"),
  // Public URL for capability card / A2A card
  publicUrl: z.string().url().optional(),
  // Port for this bridge's HTTP server
  port: z.coerce.number().int().min(1).max(65535).default(3001),
  logLevel: LogLevelSchema.default("info"),
  // Rate limits per tier
  rateLimitPublic: z.coerce.number().int().default(100),
  rateLimitStandard: z.coerce.number().int().default(1000),
  rateLimitEnterprise: z.coerce.number().int().default(10000),
  maxSubgraphEdges: z.coerce.number().int().default(50),
});

export type Config = z.infer<typeof ConfigSchema>;
export type AccessTier = z.infer<typeof AccessTierSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    capEndpoint: process.env["CAP_ENDPOINT"],
    capApiKey: process.env["CAP_API_KEY"] || undefined,
    accessTier: process.env["CAP_ACCESS_TIER"],
    publicUrl: process.env["CAP_PUBLIC_URL"] || undefined,
    port: process.env["CAP_PORT"],
    logLevel: process.env["CAP_LOG_LEVEL"],
    rateLimitPublic: process.env["CAP_RATE_LIMIT_PUBLIC"],
    rateLimitStandard: process.env["CAP_RATE_LIMIT_STANDARD"],
    rateLimitEnterprise: process.env["CAP_RATE_LIMIT_ENTERPRISE"],
    maxSubgraphEdges: process.env["CAP_MAX_SUBGRAPH_EDGES"],
  });
}
