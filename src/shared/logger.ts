import pino from "pino";

const isProduction = process.env["NODE_ENV"] === "production";
const level = process.env["LOG_LEVEL"] ?? (isProduction ? "info" : "debug");

export const logger = pino({
  level,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-api-key']",
      "headers.authorization",
      "headers['x-api-key']",
      "*.firstName",
      "*.lastName",
      "*.idNumber",
      "*.email",
      "*.phone"
    ],
    censor: "[REDACTED]"
  },
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:HH:MM:ss.l",
          ignore: "pid,hostname"
        }
      }
});
