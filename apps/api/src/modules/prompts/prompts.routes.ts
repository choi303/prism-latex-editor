import type { FastifyPluginAsync } from "fastify";

import { listPrompts } from "./prompts.service.js";

export const promptRoutes: FastifyPluginAsync = async (app) => {
  app.get("/prompts", async () => ({
    data: listPrompts()
  }));
};