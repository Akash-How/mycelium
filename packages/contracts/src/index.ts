import { z } from "zod";

export const FieldType = z.enum(["string", "number", "boolean", "url"]);
export type FieldType = z.infer<typeof FieldType>;

// The plain-language `description` does double duty: it documents the field
// and it is the raw material the diagnostician compiles into a heal prompt.
export const Field = z.object({
  name: z.string(),
  type: FieldType,
  required: z.boolean(),
  description: z.string().min(10),
  sample: z.string(),
});
export type Field = z.infer<typeof Field>;

export const Contract = z.object({
  collectorId: z.string().regex(/^c_[a-z0-9]+$/),
  sourceUrl: z.string().url(),
  minRows: z.number().int().positive(),
  fields: z.array(Field).min(1),
});
export type Contract = z.infer<typeof Contract>;

export const Verdict = z.enum(["healthy", "degraded", "broken"]);
export type Verdict = z.infer<typeof Verdict>;

export const GateResults = z.object({
  contract: z.boolean(),
  golden: z.boolean(),
  continuity: z.boolean(),
});
export type GateResults = z.infer<typeof GateResults>;

export type Row = Record<string, unknown>;

export interface RunScore {
  verdict: Verdict;
  rowCount: number;
  nullRates: Record<string, number>;
  typeErrors: Record<string, number>;
  shapeHash: string;
}

export interface Baseline {
  rowCount: number;
  nullRates: Record<string, number>;
}

export const MyceliumConfig = z.object({
  fleet: z.object({ maxCollectors: z.number().int().positive() }),
  countries: z.array(z.string().length(2)),
  schedule: z.object({
    sweepsPerDay: z.number().int().positive(),
    jitterSeconds: z.number().int().nonnegative(),
  }),
  heal: z.object({
    maxAttemptsPerIncident: z.number().int().positive(),
    quarantineThreshold: z.number().int().positive(),
    quarantineWindowHours: z.number().int().positive(),
  }),
  budget: z.object({
    creditCeilingPerDay: z.number().int().positive(),
    hardStop: z.boolean(),
  }),
});
export type MyceliumConfig = z.infer<typeof MyceliumConfig>;
