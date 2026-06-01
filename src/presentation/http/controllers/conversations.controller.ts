import type { NextFunction, Response } from "express";
import type { SendChatMessageUseCase } from "../../../application/use-cases/conversations/SendChatMessageUseCase.js";
import type { StartConversationUseCase } from "../../../application/use-cases/conversations/StartConversationUseCase.js";
import type {
  DeleteConversationUseCase,
  GetConversationUseCase,
  ListConversationsUseCase,
  UpdateConversationPreferenceUseCase
} from "../../../application/use-cases/conversations/ConversationQueryUseCases.js";
import { conversationDto, messageDto } from "../dto/index.js";
import {
  conversationIdParamSchema,
  createConversationSchema,
  listConversationsQuerySchema,
  sendChatMessageSchema,
  updateConversationPreferenceSchema
} from "../schemas/conversation.schema.js";
import { requireAuth, type RequestWithAuth } from "../middleware/authMiddleware.js";
import { SseWriter } from "../sse/SseWriter.js";
import { AppError } from "../../../shared/errors.js";

export interface ConversationsControllerDeps {
  startConversation: StartConversationUseCase;
  sendChatMessage: SendChatMessageUseCase;
  listConversations: ListConversationsUseCase;
  getConversation: GetConversationUseCase;
  deleteConversation: DeleteConversationUseCase;
  updateConversationPreference: UpdateConversationPreferenceUseCase;
  maxChatHistoryMessages: number;
}

export class ConversationsController {
  private readonly startConversation: StartConversationUseCase;
  private readonly sendChatMessage: SendChatMessageUseCase;
  private readonly listConversations: ListConversationsUseCase;
  private readonly getConversation: GetConversationUseCase;
  private readonly deleteConversation: DeleteConversationUseCase;
  private readonly updateConversationPreference: UpdateConversationPreferenceUseCase;
  private readonly maxChatHistoryMessages: number;

  constructor(deps: ConversationsControllerDeps) {
    this.startConversation = deps.startConversation;
    this.sendChatMessage = deps.sendChatMessage;
    this.listConversations = deps.listConversations;
    this.getConversation = deps.getConversation;
    this.deleteConversation = deps.deleteConversation;
    this.updateConversationPreference = deps.updateConversationPreference;
    this.maxChatHistoryMessages = deps.maxChatHistoryMessages;
  }

  create = async (req: RequestWithAuth, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = requireAuth(req);
      const body = createConversationSchema.parse(req.body);
      const result = await this.startConversation.execute({
        clientId: ctx.client.id,
        userId: ctx.userId,
        summaryId: body.summaryId ?? null,
        kind: body.kind,
        entityId: body.entityId ?? null,
        title: body.title ?? null,
        modelPreference: body.modelPreference
      });
      res.status(201).json({ conversation: conversationDto(result.conversation) });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: RequestWithAuth, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = requireAuth(req);
      const query = listConversationsQuerySchema.parse(req.query);
      const items = await this.listConversations.execute({
        clientId: ctx.client.id,
        userId: ctx.userId,
        limit: query.limit,
        offset: query.offset
      });
      res.status(200).json({ items: items.map(conversationDto) });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: RequestWithAuth, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = requireAuth(req);
      const { id } = conversationIdParamSchema.parse(req.params);
      const { conversation, messages } = await this.getConversation.execute({
        clientId: ctx.client.id,
        userId: ctx.userId,
        conversationId: id,
        messageLimit: this.maxChatHistoryMessages
      });
      res.status(200).json({
        conversation: conversationDto(conversation),
        messages: messages.map(messageDto)
      });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: RequestWithAuth, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = requireAuth(req);
      const { id } = conversationIdParamSchema.parse(req.params);
      await this.deleteConversation.execute({
        clientId: ctx.client.id,
        userId: ctx.userId,
        conversationId: id
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  };

  updatePreference = async (
    req: RequestWithAuth,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ctx = requireAuth(req);
      const { id } = conversationIdParamSchema.parse(req.params);
      const body = updateConversationPreferenceSchema.parse(req.body);
      const conversation = await this.updateConversationPreference.execute({
        clientId: ctx.client.id,
        userId: ctx.userId,
        conversationId: id,
        modelPreference: body.modelPreference,
      });
      res.status(200).json({ conversation: conversationDto(conversation) });
    } catch (err) {
      next(err);
    }
  };

  postMessage = async (
    req: RequestWithAuth,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const ctx = (() => {
      try {
        return requireAuth(req);
      } catch (err) {
        next(err);
        return null;
      }
    })();
    if (!ctx) return;

    let id: string;
    let body: { message: string };
    try {
      id = conversationIdParamSchema.parse(req.params).id;
      body = sendChatMessageSchema.parse(req.body);
    } catch (err) {
      next(err);
      return;
    }

    const sse = new SseWriter(res);

    try {
      await this.sendChatMessage.execute(
        {
          clientId: ctx.client.id,
          userId: ctx.userId,
          conversationId: id,
          message: body.message,
          maxHistoryMessages: this.maxChatHistoryMessages
        },
        {
          onConversation: (conv) => {
            sse.send({ event: "conversation", data: conversationDto(conv) });
          },
          onChunk: (chunk) => {
            if (chunk.delta) {
              sse.send({ event: "delta", data: { delta: chunk.delta } });
            }
            if (chunk.done) {
              sse.send({ event: "done", data: { done: true } });
            }
          },
          onCompleted: (userMessage, assistantMessage) => {
            sse.send({
              event: "completed",
              data: {
                userMessage: messageDto(userMessage),
                assistantMessage: messageDto(assistantMessage)
              }
            });
          },
          onTitle: (conv) => {
            sse.send({ event: "title", data: conversationDto(conv) });
          }
        }
      );
      sse.end();
    } catch (err) {
      const payload =
        err instanceof AppError
          ? { code: err.code, message: err.message, details: err.details }
          : { code: "INTERNAL_ERROR", message: "Internal server error" };
      sse.send({ event: "error", data: { error: payload } });
      sse.end();
    }
  };
}
