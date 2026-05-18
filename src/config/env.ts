import dotenvFlow from "dotenv-flow";
import { z } from "zod";

dotenvFlow.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8080),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    SUPABASE_URL: z.string().url(),

    SUPABASE_SECRET_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    DEEPSEEK_API_KEY: z.string().optional().default(""),
    DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com/v1"),
    DEEPSEEK_MODEL: z.string().default("deepseek-chat"),

    OPENROUTER_API_KEY: z.string().optional().default(""),
    OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
    OPENROUTER_SITE_URL: z.string().url().optional(),
    OPENROUTER_SITE_NAME: z.string().optional(),
    OPENROUTER_AUTO_MODELS: z
      .string()
      .default(
        "deepseek/deepseek-chat-v3.1:free,google/gemini-2.0-flash-exp:free,meta-llama/llama-3.3-70b-instruct:free",
      ),

    PROMPT_VERSION_MEDICAL_RECORD: z.string().default("medical-record-v1"),
    PROMPT_VERSION_EVOLUTION: z.string().default("evolution-v1"),
    PROMPT_VERSION_CHAT: z.string().default("chat-system-v1"),

    RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
    MAX_CHAT_HISTORY_MESSAGES: z.coerce.number().int().positive().default(20),
  })
  .superRefine((value, ctx) => {
    if (!value.SUPABASE_SECRET_KEY && !value.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_SECRET_KEY"],
        message:
          "SUPABASE_SECRET_KEY is required (or the legacy SUPABASE_SERVICE_ROLE_KEY as fallback).",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

const resolvedSupabaseSecretKey =
  raw.SUPABASE_SECRET_KEY?.trim() || raw.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

export const env = {
  ...raw,
  SUPABASE_SECRET_KEY: resolvedSupabaseSecretKey,
  OPENROUTER_AUTO_MODELS_LIST: raw.OPENROUTER_AUTO_MODELS.split(",")
    .map((m) => m.trim())
    .filter(Boolean),
} as const;

export type AppEnv = typeof env;
