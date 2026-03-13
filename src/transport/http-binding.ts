// src/transport/http-binding.ts
//
// §8.1 CAP HTTP Binding — Express-based.
// POST /v1/{category}/{name} → dispatch verb
// GET /.well-known/cap.json → Capability Card

import { timingSafeEqual } from "node:crypto";
import express from "express";
import type { Request, Response } from "express";
import type { BoundDispatcher } from "./shared-types.js";
import type { VerbResult } from "../verbs/handler.js";
import type { Config } from "../config.js";
import {
  RequestEnvelopeSchema,
  buildSuccessResponse,
  buildErrorResponse,
} from "../cap/envelope.js";
import { buildCapabilityCard } from "../cap/capability-card.js";
import { buildProvenance } from "../cap/provenance.js";
import { CAPError } from "../cap/errors.js";
import { checkVerbAccess, getResponseDetail } from "../security/tiers.js";
import type { AccessTier } from "../security/tiers.js";
import { obfuscateResponse } from "../security/obfuscation.js";
import type { ResponseDetail } from "../security/obfuscation.js";
import { RateLimiter } from "../security/rate-limiter.js";

// Detail level hierarchy for downgrade check
const DETAIL_RANK: Record<ResponseDetail, number> = {
  summary: 0,
  full: 1,
  raw: 2,
};

function resolveDetail(
  tierDetail: ResponseDetail,
  requestedDetail?: string
): ResponseDetail {
  if (!requestedDetail) return tierDetail;
  const req = requestedDetail as ResponseDetail;
  if (!(req in DETAIL_RANK)) return tierDetail;
  // Client can downgrade but not upgrade
  return DETAIL_RANK[req] <= DETAIL_RANK[tierDetail] ? req : tierDetail;
}

function extractApiKey(req: Request): string | undefined {
  // §8.1: X-CAP-Key header (preferred)
  const capKey = req.headers["x-cap-key"] as string | undefined;
  if (capKey && capKey.trim()) return capKey.trim();
  // §8.1: Authorization: Bearer {token} (alternative)
  const auth = req.headers["authorization"] as string | undefined;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return undefined;
}

function resolveTier(req: Request, config: Config): AccessTier {
  const key = extractApiKey(req);
  if (!key) return "public";
  // Validate key against configured API key (timing-safe comparison)
  if (config.abelApiKey) {
    const expected = Buffer.from(config.abelApiKey);
    const provided = Buffer.from(key);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return "public"; // invalid key treated as unauthenticated
    }
  }
  return config.accessTier as AccessTier;
}

function getRateLimit(tier: AccessTier, config: Config): number {
  if (tier === "enterprise") return config.rateLimitEnterprise;
  if (tier === "standard") return config.rateLimitStandard;
  return config.rateLimitPublic;
}

export function createHttpApp(
  dispatcher: BoundDispatcher,
  config: Config
): express.Express {
  const app = express();
  app.use(express.json());

  const rateLimiter = new RateLimiter();

  // ── /.well-known/cap.json
  app.get("/.well-known/cap.json", (_req: Request, res: Response) => {
    const endpoint = config.publicUrl ?? `http://localhost:${config.port}`;
    const card = buildCapabilityCard(endpoint);
    res.json(card);
  });

  // ── POST /v1/:category/:name
  app.post("/v1/:category/:name", async (req: Request, res: Response) => {
    const pathVerb = `${req.params["category"]}.${req.params["name"]}`;

    // Parse and validate request envelope
    const parseResult = RequestEnvelopeSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errorResp = buildErrorResponse(
        (req.body as Record<string, unknown>)?.["request_id"] as string ??
          "00000000-0000-0000-0000-000000000000",
        pathVerb,
        new CAPError("query_type_not_supported", {
          suggestion: "Request body must be a valid CAP request envelope",
          details: { validation_errors: parseResult.error.issues },
        })
      );
      res.status(400).json(errorResp);
      return;
    }

    const envelope = parseResult.data;

    // Verify verb in path matches verb in envelope
    if (envelope.verb !== pathVerb) {
      const errorResp = buildErrorResponse(
        envelope.request_id,
        pathVerb,
        new CAPError("query_type_not_supported", {
          suggestion: `URL verb '${pathVerb}' does not match envelope verb '${envelope.verb}'`,
        })
      );
      res.status(400).json(errorResp);
      return;
    }

    // Resolve access tier
    const tier = resolveTier(req, config);

    // Rate limiting
    const clientId = extractApiKey(req) ?? req.ip ?? "anonymous";
    const limit = getRateLimit(tier, config);
    if (!rateLimiter.check(clientId, limit)) {
      const errorResp = buildErrorResponse(
        envelope.request_id,
        pathVerb,
        new CAPError("rate_limited", {
          suggestion: "Wait before retrying or upgrade access tier",
        })
      );
      res.status(429).json(errorResp);
      return;
    }
    rateLimiter.record(clientId);

    // §9.1: Verb access check — enforce for ALL tiers
    if (!checkVerbAccess(envelope.verb, tier)) {
      const errorResp = buildErrorResponse(
        envelope.request_id,
        pathVerb,
        new CAPError("insufficient_tier", {
          suggestion: `Verb '${envelope.verb}' requires a higher access tier than '${tier}'`,
        })
      );
      res.status(403).json(errorResp);
      return;
    }

    // Resolve response detail
    const tierDetail = getResponseDetail(tier);
    const detail = resolveDetail(tierDetail, envelope.options?.response_detail);

    try {
      // Dispatch verb (client already curried in BoundDispatcher)
      const verbResult: VerbResult = await dispatcher(
        envelope.verb,
        envelope.params
      );

      // Obfuscate response based on detail level
      const obfuscated = obfuscateResponse(verbResult.result, detail);

      // Build provenance if handler returned it
      const provenance = verbResult.provenance
        ? (buildProvenance(
            verbResult.provenance
          ) as unknown as Record<string, unknown>)
        : undefined;

      const response = buildSuccessResponse(
        envelope.request_id,
        envelope.verb,
        obfuscated,
        provenance
      );
      res.json(response);
    } catch (err) {
      if (err instanceof CAPError) {
        const errorResp = buildErrorResponse(
          envelope.request_id,
          envelope.verb,
          err
        );
        res.status(err.httpStatus).json(errorResp);
      } else {
        const errorResp = buildErrorResponse(
          envelope.request_id,
          envelope.verb,
          new CAPError("internal_error", {
            suggestion: "An unexpected error occurred. Please retry or contact support.",
          })
        );
        res.status(500).json(errorResp);
      }
    }
  });

  return app;
}
