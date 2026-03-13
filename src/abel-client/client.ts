/**
 * Typed HTTP client for Abel API.
 *
 * All Abel backend calls go through this client.
 * Verb handlers never call fetch() directly.
 */

import type {
  AbelBatchPredictionResponse,
  AbelChildrenResponse,
  AbelFeaturesResponse,
  AbelHealthResponse,
  AbelInterveneRequest,
  AbelInterveneResponse,
  AbelLatestChangeResponse,
  AbelMultiStepPredictionResponse,
  AbelPredictionResponse,
} from "./types.js";

export interface AbelClientConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
}

export class AbelClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(config: AbelClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = {
      "Content-Type": "application/json",
      ...(config.apiKey && { Authorization: `Bearer ${config.apiKey}` }),
    };
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `Abel API error: ${response.status} ${response.statusText} for GET ${path}`
      );
    }
    return (await response.json()) as T;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(
        `Abel API error: ${response.status} ${response.statusText} for POST ${path}`
      );
    }
    return (await response.json()) as T;
  }

  // ── Causal Graph ──────────────────────────────────────

  async getFeatures(ticker: string): Promise<AbelFeaturesResponse> {
    return this.get(`/causal_graph/${encodeURIComponent(ticker)}/features`);
  }

  async getChildren(ticker: string): Promise<AbelChildrenResponse> {
    return this.get(`/causal_graph/${encodeURIComponent(ticker)}/children`);
  }

  async getPrediction(ticker: string): Promise<AbelPredictionResponse> {
    return this.get(`/causal_graph/${encodeURIComponent(ticker)}/prediction`);
  }

  async getMultiStepPrediction(
    ticker: string
  ): Promise<AbelMultiStepPredictionResponse> {
    return this.get(
      `/causal_graph/${encodeURIComponent(ticker)}/multi-step-prediction`
    );
  }

  async getBatchPrediction(
    tickers: string[]
  ): Promise<AbelBatchPredictionResponse> {
    const params = tickers
      .map((t) => `tickers=${encodeURIComponent(t)}`)
      .join("&");
    return this.get(`/causal_graph/multi-step-prediction/batch?${params}`);
  }

  async getLatestChange(): Promise<AbelLatestChangeResponse> {
    return this.get("/causal_graph/ticker_nodes/latest_change");
  }

  // ── Intervention (L2) ─────────────────────────────────

  async intervene(
    request: AbelInterveneRequest
  ): Promise<AbelInterveneResponse> {
    return this.post("/causal_graph/intervene", request);
  }

  // ── Health ────────────────────────────────────────────

  async getHealth(): Promise<AbelHealthResponse> {
    return this.get("/health");
  }
}
