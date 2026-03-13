/**
 * CAP Provenance Builder — v0.2.2 §6.9
 *
 * Constructs provenance objects for CAP responses.
 * Provenance provides transparency about how the result was computed.
 */

export interface Provenance {
  algorithm: string;
  graph_version: string;
  graph_timestamp: string;
  computation_time_ms: number;
  sample_size?: number;
  mechanism_family_used?: string;
  mechanism_model_version?: string;
  server_name: string;
  server_version: string;
  cap_spec_version: string;
}

const SERVER_NAME = "Abel Social Physical Engine";
const SERVER_VERSION = "0.1.0";
const CAP_SPEC_VERSION = "0.2.2";

export interface ProvenanceInput {
  graphVersion: string;
  graphTimestamp: string;
  computationTimeMs: number;
  sampleSize?: number;
  mechanismFamilyUsed?: string;
  mechanismModelVersion?: string;
}

export function buildProvenance(input: ProvenanceInput): Provenance {
  return {
    algorithm: "PCMCI",
    graph_version: input.graphVersion,
    graph_timestamp: input.graphTimestamp,
    computation_time_ms: input.computationTimeMs,
    ...(input.sampleSize !== undefined && { sample_size: input.sampleSize }),
    ...(input.mechanismFamilyUsed && {
      mechanism_family_used: input.mechanismFamilyUsed,
    }),
    ...(input.mechanismModelVersion && {
      mechanism_model_version: input.mechanismModelVersion,
    }),
    server_name: SERVER_NAME,
    server_version: SERVER_VERSION,
    cap_spec_version: CAP_SPEC_VERSION,
  };
}
