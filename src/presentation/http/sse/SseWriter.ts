import type { Response } from "express";

export interface SseEvent<T = unknown> {
  event?: string;
  id?: string;
  data: T;
}

export class SseWriter {
  private readonly res: Response;
  private closed: boolean;
  private heartbeat: NodeJS.Timeout | null;

  constructor(res: Response, heartbeatMs = 15_000) {
    this.res = res;
    this.closed = false;
    this.heartbeat = null;
    this.start(heartbeatMs);
  }

  private start(heartbeatMs: number): void {
    this.res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    this.res.setHeader("Cache-Control", "no-cache, no-transform");
    this.res.setHeader("Connection", "keep-alive");
    this.res.setHeader("X-Accel-Buffering", "no");
    this.res.flushHeaders?.();

    this.heartbeat = setInterval(() => {
      if (this.closed) return;
      this.res.write(": ping\n\n");
    }, heartbeatMs);

    this.res.on("close", () => this.cleanup());
  }

  send(event: SseEvent): void {
    if (this.closed) return;
    const lines: string[] = [];
    if (event.event) lines.push(`event: ${event.event}`);
    if (event.id) lines.push(`id: ${event.id}`);
    const payload = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
    for (const line of payload.split("\n")) {
      lines.push(`data: ${line}`);
    }
    lines.push("", "");
    this.res.write(lines.join("\n"));
  }

  end(finalEvent?: SseEvent): void {
    if (this.closed) return;
    if (finalEvent) this.send(finalEvent);
    this.cleanup();
    this.res.end();
  }

  isClosed(): boolean {
    return this.closed;
  }

  private cleanup(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
  }
}
