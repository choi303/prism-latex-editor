import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { enqueueFile, listFiles } from "./files.service.js";

const createFileSchema = z.object({
  filename: z.string().min(1).max(240),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().nonnegative().max(50_000_000)
});

export const fileRoutes: FastifyPluginAsync = async (app) => {
  app.get("/files", async () => ({
    data: listFiles()
  }));

  app.post("/files", async (request, reply) => {
    const parsed = createFileSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.flatten()
      });
    }

    return reply.code(201).send({
      data: enqueueFile(parsed.data.filename, parsed.data.mimeType, parsed.data.size)
    });
  });
};