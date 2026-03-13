/**
 * Shared Zod schemas used across verb handlers.
 */

import { z } from "zod";

export const UnitSchema = z.enum(["log_return", "percentage", "absolute", "std_dev"]);

export type Unit = z.infer<typeof UnitSchema>;

export const DirectionSchema = z.enum(["up", "down", "neutral"]);

export const SortBySchema = z.enum(["weight", "tau", "name"]);

export const NeighborDirectionSchema = z.enum(["parents", "children", "both"]);

export const InterventionSchema = z.object({
  node_id: z.string().min(1),
  value: z.number(),
  unit: UnitSchema,
});

export type Intervention = z.infer<typeof InterventionSchema>;

export const CausalFeatureSchema = z.object({
  node_id: z.string(),
  node_name: z.string(),
  node_type: z.string(),
  edge_type: z.string(),
  impact: z.number(),
  impact_fraction: z.number(),
  weight: z.number(),
  tau: z.number().int(),
  tau_duration: z.string(),
  current_value: z.number().optional(),
  current_change_percent: z.number().optional(),
});

export type CausalFeature = z.infer<typeof CausalFeatureSchema>;
