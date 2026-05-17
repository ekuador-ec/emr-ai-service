import { z } from "zod";
import { modelPreferenceSchema, summaryKindSchema } from "./summary.schema.js";

export const createConversationSchema = z.object({
  summaryId: z.string().uuid().nullable().optional(),
  kind: summaryKindSchema,
  entityId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).nullable().optional(),
  modelPreference: modelPreferenceSchema.default("auto")
});

export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0)
});

export const conversationIdParamSchema = z.object({
  id: z.string().uuid()
});

export const sendChatMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000)
});

export type CreateConversationDto = z.infer<typeof createConversationSchema>;
export type SendChatMessageDto = z.infer<typeof sendChatMessageSchema>;
