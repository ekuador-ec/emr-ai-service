import type { NextFunction, Response } from "express";
import type { GenerateSummaryUseCase } from "../../../application/use-cases/summaries/GenerateSummaryUseCase.js";
import type { GetLatestSummaryUseCase } from "../../../application/use-cases/summaries/GetLatestSummaryUseCase.js";
import type { SummaryKind } from "../../../domain/models/Summary.js";
import { NotFoundError } from "../../../shared/errors.js";
import { logger } from "../../../shared/logger.js";
import { summaryDto } from "../dto/index.js";
import {
  generateSummarySchema,
  summaryKindParamSchema
} from "../schemas/summary.schema.js";
import { requireAuth, type RequestWithAuth } from "../middleware/authMiddleware.js";

export interface SummariesControllerDeps {
  generateSummary: GenerateSummaryUseCase;
  getLatestSummary: GetLatestSummaryUseCase;
}

export class SummariesController {
  private readonly generateSummary: GenerateSummaryUseCase;
  private readonly getLatestSummary: GetLatestSummaryUseCase;

  constructor(deps: SummariesControllerDeps) {
    this.generateSummary = deps.generateSummary;
    this.getLatestSummary = deps.getLatestSummary;
  }

  generate = async (
    req: RequestWithAuth,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ctx = requireAuth(req);
      const kind = this.kindFromPath(req.path);

      const body = generateSummarySchema.parse(req.body);

      const result = await this.generateSummary.execute({
        clientId: ctx.client.id,
        userId: ctx.userId,
        kind,
        entityId: body.entityId,
        payload: body.payload,
        preference: body.preference,
        forceRefresh: body.forceRefresh ?? false
      });

      if (result.sanitizationFindings > 0) {
        logger.warn(
          {
            clientId: ctx.client.id,
            kind,
            entityId: body.entityId,
            findings: result.sanitizationFindings
          },
          "ServerSanitizer applied redactions, client-side anonymizer may be incomplete"
        );
      }

      res
        .status(result.cached ? 200 : 201)
        .json({ cached: result.cached, summary: summaryDto(result.summary) });
    } catch (err) {
      next(err);
    }
  };

  getLatest = async (
    req: RequestWithAuth,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const ctx = requireAuth(req);
      const { kind, entityId } = summaryKindParamSchema.parse(req.params);

      const summary = await this.getLatestSummary.execute({
        clientId: ctx.client.id,
        kind,
        entityId
      });

      if (!summary) {
        throw new NotFoundError("No summary found for this entity");
      }

      res.status(200).json({ summary: summaryDto(summary) });
    } catch (err) {
      next(err);
    }
  };

  private kindFromPath(path: string): SummaryKind {
    return path.endsWith("/medical-record") ? "medical_record" : "evolution";
  }
}
