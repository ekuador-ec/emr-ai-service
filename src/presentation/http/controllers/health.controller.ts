import type { Request, RequestHandler, Response } from "express";

export interface HealthInfo {
  version: string;
  environment: string;
}

export function createHealthHandler(info: HealthInfo): RequestHandler {
  return function healthHandler(_req: Request, res: Response): void {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: info.version,
      environment: info.environment,
    });
  };
}
