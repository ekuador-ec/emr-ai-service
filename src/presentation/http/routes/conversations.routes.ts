import { Router, type RequestHandler } from "express";
import type { ConversationsController } from "../controllers/conversations.controller.js";

export function buildConversationsRouter(
  controller: ConversationsController,
  authMiddleware: RequestHandler
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.post("/", controller.create);
  router.get("/", controller.list);
  router.get("/:id", controller.get);
  router.delete("/:id", controller.delete);
  router.post("/:id/messages", controller.postMessage);
  return router;
}
