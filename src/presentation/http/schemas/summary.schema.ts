import { z } from "zod";

export const summaryKindSchema = z.enum(["medical_record", "evolution"]);
export const modelPreferenceSchema = z.enum(["deepseek", "auto"]);

export const generateSummarySchema = z.object({
  entityId: z.string().uuid(),
  payload: z.record(z.string(), z.unknown()),
  preference: modelPreferenceSchema.default("auto"),
  forceRefresh: z.boolean().optional()
});

export const summaryKindParamSchema = z.object({
  kind: summaryKindSchema,
  entityId: z.string().uuid()
});

export type GenerateSummaryDto = z.infer<typeof generateSummarySchema>;
