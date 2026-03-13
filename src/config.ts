import { z } from "zod";

const AccessTierSchema = z.enum(["public", "standard", "enterprise"]);
const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const ConfigSchema = z.object({
  abelApiBase: z.string().url(),
  abelApiKey: z.string().default(""),
  accessTier: AccessTierSchema.default("standard"),
  port: z.coerce.number().int().min(1).max(65535).default(3001),
  logLevel: LogLevelSchema.default("info"),
  rateLimitPublic: z.coerce.number().int().default(100),
  rateLimitStandard: z.coerce.number().int().default(1000),
  rateLimitEnterprise: z.coerce.number().int().default(10000),
  maxSubgraphEdges: z.coerce.number().int().default(50),
  mcpEnabled: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
  a2aEnabled: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

export type Config = z.infer<typeof ConfigSchema>;
export type AccessTier = z.infer<typeof AccessTierSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    abelApiBase: process.env["ABEL_API_BASE"],
    abelApiKey: process.env["ABEL_API_KEY"],
    accessTier: process.env["CAP_ACCESS_TIER"],
    port: process.env["CAP_PORT"],
    logLevel: process.env["CAP_LOG_LEVEL"],
    rateLimitPublic: process.env["CAP_RATE_LIMIT_PUBLIC"],
    rateLimitStandard: process.env["CAP_RATE_LIMIT_STANDARD"],
    rateLimitEnterprise: process.env["CAP_RATE_LIMIT_ENTERPRISE"],
    maxSubgraphEdges: process.env["CAP_MAX_SUBGRAPH_EDGES"],
    mcpEnabled: process.env["CAP_MCP_ENABLED"],
    a2aEnabled: process.env["CAP_A2A_ENABLED"],
  });
}
