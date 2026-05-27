import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  assistLatexProject,
  compileLatexProject,
  createLatexProject,
  deleteLatexProject,
  getLatexProject,
  listLatexProjects,
  updateLatexProject
} from "./latex.service.js";

const createProjectSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  latex: z.string().min(1).optional()
});

const updateProjectSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  latex: z.string().min(1).optional()
});

const compileSchema = z.object({
  latex: z.string().min(1),
  projectId: z.string().optional()
});

const assistSchema = z.object({
  prompt: z.string().min(1).max(4000),
  latex: z.string().min(1).optional(),
  selection: z.string().optional(),
  cursorLine: z.number().int().positive().optional(),
  cursorColumn: z.number().int().positive().optional()
});

export const latexRoutes: FastifyPluginAsync = async (app) => {
  app.get("/projects", async () => ({
    data: await listLatexProjects()
  }));

  app.post("/projects", async (request, reply) => {
    const parsed = createProjectSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    return reply.code(201).send({
      data: await createLatexProject(parsed.data)
    });
  });

  app.get("/projects/:projectId", async (request, reply) => {
    const params = request.params as { projectId: string };

    try {
      return {
        data: await getLatexProject(params.projectId)
      };
    } catch (error) {
      return reply.code(404).send({
        error: error instanceof Error ? error.message : "Project not found"
      });
    }
  });

  app.patch("/projects/:projectId", async (request, reply) => {
    const params = request.params as { projectId: string };
    const parsed = updateProjectSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      return {
        data: await updateLatexProject(params.projectId, parsed.data)
      };
    } catch (error) {
      return reply.code(404).send({
        error: error instanceof Error ? error.message : "Project not found"
      });
    }
  });

  app.delete("/projects/:projectId", async (request, reply) => {
    const params = request.params as { projectId: string };

    try {
      return { data: await deleteLatexProject(params.projectId) };
    } catch (error) {
      return reply.code(404).send({
        error: error instanceof Error ? error.message : "Project not found"
      });
    }
  });

  app.post("/compile", async (request, reply) => {
    const parsed = compileSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      const result = await compileLatexProject({
        ...parsed.data,
        services: app.services
      });

      reply.header("Content-Type", "application/pdf");
      reply.header("X-Compile-Hash", result.hash);
      reply.header("X-Compile-Cache", result.cacheHit ? "HIT" : "MISS");
      return reply.send(result.pdfBuffer);
    } catch (error) {
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "Compilation failed"
      });
    }
  });

  app.post("/projects/:projectId/assist", async (request, reply) => {
    const params = request.params as { projectId: string };
    const parsed = assistSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    try {
      return {
        data: await assistLatexProject({
          projectId: params.projectId,
          ...parsed.data
        })
      };
    } catch (error) {
      return reply.code(502).send({
        error: error instanceof Error ? error.message : "Assistant request failed"
      });
    }
  });
};