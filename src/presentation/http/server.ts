import { env } from "../../config/env.js";
import { buildContainer } from "../../config/container.js";
import { logger } from "../../shared/logger.js";

const app = buildContainer(env);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "EMR AI Service listening");
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutdown signal received, closing server");
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during server close");
      process.exit(1);
    }
    process.exit(0);
  });
  setTimeout(() => {
    logger.warn("Forcing exit after grace period");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
