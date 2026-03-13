/**
 * Abel API TypeScript types.
 *
 * Typed from the Abel backend API responses.
 * These are the RAW Abel shapes — transformers.ts converts to CAP format.
 */

/** GET /causal_graph/{ticker}/features */
export interface AbelFeature {
  feature_name: string;
  feature_type: string;
  weight: number;
  tau: number;
  current_value?: number;
  current_change_percent?: number;
  impact?: number;
}

export interface AbelFeaturesResponse {
  ticker: string;
  features: AbelFeature[];
  intercept?: number;
  prediction?: number;
  probability_positive?: number;
}

/** GET /causal_graph/{ticker}/children */
export interface AbelChild {
  child_name: string;
  child_type: string;
  weight: number;
  tau: number;
  current_value?: number;
  current_change_percent?: number;
}

export interface AbelChildrenResponse {
  ticker: string;
  children: AbelChild[];
}

/** GET /causal_graph/{ticker}/prediction */
export interface AbelPredictionResponse {
  ticker: string;
  predicted_log_return: number;
  probability_positive: number;
  confidence_interval?: [number, number];
  features: AbelFeature[];
  intercept?: number;
  latest_value?: number;
  latest_change_percent?: number;
  timestamp?: string;
}

/** GET /causal_graph/{ticker}/multi-step-prediction */
export interface AbelMultiStepPredictionResponse {
  ticker: string;
  steps: Array<{
    step: number;
    predicted_log_return: number;
    cumulative_log_return: number;
    probability_positive: number;
    confidence_interval?: [number, number];
  }>;
  features: AbelFeature[];
}

/** GET /causal_graph/multi-step-prediction/batch */
export interface AbelBatchPredictionResponse {
  results: AbelMultiStepPredictionResponse[];
}

/** POST /causal_graph/intervene */
export interface AbelInterveneRequest {
  interventions: Array<{
    ticker: string;
    value: number;
    unit: string;
  }>;
  targets: string[];
  horizon?: string;
}

export interface AbelInterveneEffect {
  target: string;
  expected_change: number;
  unit: string;
  confidence_interval?: [number, number];
  probability_positive: number;
  propagation_delay_hours: number;
  mechanism_coverage_complete: boolean;
  causal_path?: Array<{
    from: string;
    to: string;
    weight: number;
    tau: number;
  }>;
}

export interface AbelInterveneResponse {
  interventions: AbelInterveneRequest["interventions"];
  effects: AbelInterveneEffect[];
}

/** GET /causal_graph/ticker_nodes/latest_change */
export interface AbelLatestChangeResponse {
  nodes: Array<{
    ticker: string;
    node_type: string;
    latest_value: number;
    latest_change_percent: number;
    timestamp: string;
  }>;
}

/** GET /health */
export interface AbelHealthResponse {
  status: string;
  version?: string;
  graph_version?: string;
  graph_timestamp?: string;
  node_count?: number;
  edge_count?: number;
}
