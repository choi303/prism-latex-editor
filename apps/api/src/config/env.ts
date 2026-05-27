import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_HOST: z.string().default("0.0.0.0"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_DEFAULT_MODEL: z.string().default("deepseek/deepseek-v4-flash:free"),
  OPENROUTER_FALLBACK_MODELS: z.string().default("openai/gpt-oss-20b:free,google/gemma-4-26b-a4b-it:free,qwen/qwen3-next-80b-a3b-instruct:free"),
  LATEX_COMPILER_URL: z.string().url().default("https://latex-compiler-t4tosmghlq-uc.a.run.app/compile/simple"),
  LATEX_COMPILER_ORIGIN: z.string().default("https://cybergarden.au"),
  LATEX_COMPILER_REFERER: z.string().default("https://cybergarden.au/"),
  LATEX_COMPILER_USER_AGENT: z.string().default("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"),
  LATEX_COMPILE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86400),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/prism"),
  UPSTASH_REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional()
});

export const env = envSchema.parse(process.env);