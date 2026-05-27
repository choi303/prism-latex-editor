import type { FastifyPluginAsync } from "fastify";

import { listModelSegments } from "./models.service.js";

export const modelRoutes: FastifyPluginAsync = async (app) => {
  app.get("/models", async () => ({
    data: listModelSegments()
  }));
};