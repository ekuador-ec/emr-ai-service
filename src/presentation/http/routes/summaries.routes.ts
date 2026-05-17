import { Router, type RequestHandler } from "express";
import type { SummariesController } from "../controllers/summaries.controller.js";

export function buildSummariesRouter(
  controller: SummariesController,
  authMiddleware: RequestHandler
): Router {
  const router = Router();
  router.use(authMiddleware);
  router.post("/medical-record", controller.generate);
  router.post("/evolution", controller.generate);
  router.get("/:kind/:entityId", controller.getLatest);
  return router;
}
