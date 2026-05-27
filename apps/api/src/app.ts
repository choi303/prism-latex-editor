import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import Fastify from "fastify";

import { env } from "./config/env.js";
import { connectMongo } from "./lib/mongo.js";
import { createRedisClient } from "./lib/redis.js";
import { chatRoutes } from "./modules/chat/chat.routes.js";
import { fileRoutes } from "./modules/files/files.routes.js";
import { healthRoutes } from "./modules/health/health.routes.js";
import { latexRoutes } from "./modules/latex/latex.routes.js";
import { modelRoutes } from "./modules/models/models.routes.js";
import { promptRoutes } from "./modules/prompts/prompts.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024 // 10 MB — large LaTeX documents
  });

  await connectMongo(env.MONGODB_URI).catch(() => null);
  const redis = createRedisClient({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
    redisUrl: env.UPSTASH_REDIS_URL
  });

  app.decorate("services", {
    redis,
    openRouterConfigured: Boolean(env.OPENROUTER_API_KEY)
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((value) => value.trim())
  });
  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024,
      files: 4
    }
  });

  await app.register(healthRoutes, { prefix: "/v1" });
  await app.register(modelRoutes, { prefix: "/v1" });
  await app.register(promptRoutes, { prefix: "/v1" });
  await app.register(chatRoutes, { prefix: "/v1" });
  await app.register(fileRoutes, { prefix: "/v1" });
  await app.register(latexRoutes, { prefix: "/v1/latex" });

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    services: {
      redis: ReturnType<typeof createRedisClient>;
      openRouterConfigured: boolean;
    };
  }
}