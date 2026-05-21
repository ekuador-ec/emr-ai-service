import { z } from "zod";
import { conversationKindSchema, modelPreferenceSchema } from "./summary.schema.js";

export const createConversationSchema = z
  .object({
    summaryId: z.string().uuid().nullable().optional(),
    kind: conversationKindSchema,
    entityId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    modelPreference: modelPreferenceSchema.default("auto"),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "general") {
      if (value.entityId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entityId"],
          message: "entityId must be null for general conversations",
        });
      }
      if (value.summaryId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["summaryId"],
          message: "summaryId must be null for general conversations",
        });
      }
    } else if (!value.entityId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entityId"],
        message: `entityId is required for kind '${value.kind}'`,
      });
    }
  });

export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const conversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const sendChatMessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
});

export const updateConversationPreferenceSchema = z.object({
  modelPreference: modelPreferenceSchema,
});

export type CreateConversationDto = z.infer<typeof createConversationSchema>;
export type SendChatMessageDto = z.infer<typeof sendChatMessageSchema>;
