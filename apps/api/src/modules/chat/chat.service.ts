import { randomUUID } from "node:crypto";

import { env } from "../../config/env.js";

type CreateConversationInput = {
  title: string;
  modelSegment: "fast" | "balanced" | "premium";
};

type SendMessageInput = {
  conversationId: string;
  content: string;
};

type ConversationRecord = {
  id: string;
  title: string;
  modelSegment: "fast" | "balanced" | "premium";
  updatedAt: string;
  preview: string;
};

type MessageRecord = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

const conversations: ConversationRecord[] = [];

const messages: MessageRecord[] = [];

function resolveModelForSegment(segment: ConversationRecord["modelSegment"]) {
  switch (segment) {
    case "fast":
    case "balanced":
    case "premium":
      return env.OPENROUTER_DEFAULT_MODEL;
    default:
      return env.OPENROUTER_DEFAULT_MODEL;
  }
}

function getModelCandidates(segment: ConversationRecord["modelSegment"]) {
  const primaryModel = resolveModelForSegment(segment);
  const fallbackModels = env.OPENROUTER_FALLBACK_MODELS.split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return [primaryModel, ...fallbackModels].filter((model, index, models) => models.indexOf(model) === index);
}

async function requestChatCompletion(model: string, history: MessageRecord[]) {
  const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Prism"
    },
    body: JSON.stringify({
      model,
      messages: history.map((message) => ({
        role: message.role,
        content: message.content
      }))
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed for ${model}: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error(`OpenRouter returned an empty response for ${model}.`);
  }

  return content;
}

async function generateAssistantReply(conversation: ConversationRecord, history: MessageRecord[]) {
  if (!env.OPENROUTER_API_KEY) {
    return "OpenRouter API key is missing. Add OPENROUTER_API_KEY to apps/api/.env to enable live replies.";
  }

  const models = getModelCandidates(conversation.modelSegment);
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      return await requestChatCompletion(model, history);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown OpenRouter error");
    }
  }

  throw lastError ?? new Error("OpenRouter request failed.");
}

export function listConversations() {
  return conversations;
}

export function createConversation(input: CreateConversationInput) {
  const conversation = {
    id: randomUUID(),
    title: input.title,
    modelSegment: input.modelSegment,
    updatedAt: new Date().toISOString(),
    preview: ""
  };

  conversations.unshift(conversation);
  return conversation;
}

export function listMessages(conversationId: string) {
  return messages.filter((message) => message.conversationId === conversationId);
}

export async function sendMessage(input: SendMessageInput) {
  const conversation = conversations.find((item) => item.id === input.conversationId);

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const userMessage: MessageRecord = {
    id: randomUUID(),
    conversationId: input.conversationId,
    role: "user",
    content: input.content,
    createdAt: new Date().toISOString()
  };

  messages.push(userMessage);

  const history = listMessages(input.conversationId);
  const assistantContent = await generateAssistantReply(conversation, history);

  const assistantMessage: MessageRecord = {
    id: randomUUID(),
    conversationId: input.conversationId,
    role: "assistant",
    content: assistantContent,
    createdAt: new Date().toISOString()
  };

  conversation.preview = input.content.slice(0, 88);
  conversation.updatedAt = assistantMessage.createdAt;
  messages.push(assistantMessage);
  return { userMessage, assistantMessage };
}