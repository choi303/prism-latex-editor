import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import {
  createConversation,
  listConversations,
  listMessages,
  sendMessage
} from "./chat.service.js";

const createConversationSchema = z.object({
  title: z.string().min(2).max(120),
  modelSegment: z.enum(["fast", "balanced", "premium"]).default("balanced")
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(12000)
});

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.get("/conversations", async () => ({
    data: listConversations()
  }));

  app.post("/conversations", async (request, reply) => {
    const parsed = createConversationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.flatten()
      });
    }

    return reply.code(201).send({
      data: createConversation(parsed.data)
    });
  });

  app.get("/conversations/:conversationId/messages", async (request) => {
    const params = request.params as { conversationId: string };

    return {
      data: listMessages(params.conversationId)
    };
  });

  app.post("/conversations/:conversationId/messages", async (request, reply) => {
    const params = request.params as { conversationId: string };
    const parsed = sendMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: parsed.error.flatten()
      });
    }

    try {
      return reply.code(201).send({
        data: await sendMessage({
          conversationId: params.conversationId,
          content: parsed.data.content
        })
      });
    } catch (error) {
      return reply.code(404).send({
        error: error instanceof Error ? error.message : "Conversation not found"
      });
    }
  });
};