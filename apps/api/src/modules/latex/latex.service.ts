import { createHash } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { env } from "../../config/env.js";
import { LatexProjectModel } from "../../db/schemas/latex-project.schema.js";
import { redisKeys } from "../../lib/redis.js";
import { buildLatexAssistantMessages, defaultLatexDocument } from "./latex.prompt.js";

type Services = FastifyInstance["services"];

type CreateProjectInput = {
  title?: string;
  latex?: string;
};

type UpdateProjectInput = {
  title?: string;
  latex?: string;
};

type CompileInput = {
  latex: string;
  projectId?: string;
  services: Services;
};

type AssistInput = {
  projectId: string;
  prompt: string;
  latex?: string;
  selection?: string;
  cursorLine?: number;
  cursorColumn?: number;
};

const assistantResponseSchema = z.object({
  updatedLatex: z.string().min(1),
  summary: z.string().min(1).max(240),
  explanation: z.string().min(1),
  diagnostics: z
    .array(
      z.object({
        line: z.number().int().positive().optional(),
        message: z.string().min(1)
      })
    )
    .default([])
});

function normalizeProject(project: any) {
  return {
    id: String(project._id),
    title: project.title,
    latex: project.latex,
    updatedAt: new Date(project.updatedAt).toISOString(),
    createdAt: new Date(project.createdAt).toISOString(),
    lastCompiledAt: project.lastCompiledAt ? new Date(project.lastCompiledAt).toISOString() : null,
    lastCompiledHash: project.lastCompiledHash ?? null,
    lastAssistantSummary: project.lastAssistantSummary ?? "",
    assistantHistory: (project.assistantHistory ?? []).map((entry: any) => ({
      role: entry.role,
      content: entry.content,
      summary: entry.summary ?? "",
      createdAt: new Date(entry.createdAt ?? Date.now()).toISOString()
    }))
  };
}

function buildProjectTitle(title?: string) {
  const trimmedTitle = title?.trim();
  return trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : "Untitled LaTeX Project";
}

function getModelCandidates() {
  return [env.OPENROUTER_DEFAULT_MODEL, ...env.OPENROUTER_FALLBACK_MODELS.split(",")]
    .map((model) => model.trim())
    .filter(Boolean)
    .filter((model, index, models) => models.indexOf(model) === index);
}

function extractJsonObject(content: string) {
  const trimmedContent = content.trim();
  const fenced = trimmedContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmedContent;
  const startIndex = candidate.indexOf("{");
  const endIndex = candidate.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("Assistant response did not include a JSON object.");
  }

  return candidate.slice(startIndex, endIndex + 1);
}

async function requestOpenRouterCompletion(messages: Array<{ role: string; content: string }>, model: string) {
  const response = await fetch(`${env.OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Prism LaTeX Editor"
    },
    body: JSON.stringify({
      model,
      messages
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

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`OpenRouter returned an empty assistant response for ${model}.`);
  }

  return content;
}

async function generateLatexAssistResult(input: {
  title: string;
  latex: string;
  userPrompt: string;
  selection?: string;
  cursorLine?: number;
  cursorColumn?: number;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
}) {
  if (!env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY is missing.");
  }

  const messages = buildLatexAssistantMessages(input);
  let lastError: Error | null = null;

  for (const model of getModelCandidates()) {
    try {
      const content = await requestOpenRouterCompletion(messages, model);
      const parsed = JSON.parse(extractJsonObject(content));
      return assistantResponseSchema.parse(parsed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown OpenRouter error");
    }
  }

  throw lastError ?? new Error("OpenRouter could not produce a LaTeX edit.");
}

export async function listLatexProjects() {
  const projects = await LatexProjectModel.find({}, { title: 1, updatedAt: 1, lastCompiledAt: 1, lastCompiledHash: 1 })
    .sort({ updatedAt: -1 })
    .lean();

  return projects.map((project) => ({
    id: String(project._id),
    title: project.title,
    updatedAt: new Date(project.updatedAt).toISOString(),
    lastCompiledAt: project.lastCompiledAt ? new Date(project.lastCompiledAt).toISOString() : null,
    lastCompiledHash: project.lastCompiledHash ?? null
  }));
}

export async function createLatexProject(input: CreateProjectInput) {
  const project = await LatexProjectModel.create({
    title: buildProjectTitle(input.title),
    latex: input.latex?.trim() ? input.latex : defaultLatexDocument
  });

  return normalizeProject(project.toObject());
}

export async function getLatexProject(projectId: string) {
  const project = await LatexProjectModel.findById(projectId).lean();

  if (!project) {
    throw new Error("Project not found");
  }

  return normalizeProject(project);
}

export async function deleteLatexProject(projectId: string) {
  const project = await LatexProjectModel.findByIdAndDelete(projectId).lean();

  if (!project) {
    throw new Error("Project not found");
  }

  return { id: projectId };
}

export async function updateLatexProject(projectId: string, input: UpdateProjectInput) {
  const update: Record<string, unknown> = {};

  if (typeof input.title === "string") {
    update.title = buildProjectTitle(input.title);
  }

  if (typeof input.latex === "string") {
    update.latex = input.latex;
  }

  const project = await LatexProjectModel.findByIdAndUpdate(projectId, update, {
    new: true,
    runValidators: true
  }).lean();

  if (!project) {
    throw new Error("Project not found");
  }

  return normalizeProject(project);
}

export async function compileLatexProject(input: CompileInput) {
  const latex = input.latex.trim().length > 0 ? input.latex : defaultLatexDocument;
  const hash = createHash("sha256").update(latex).digest("hex");
  const cacheKey = redisKeys.latexCompile(hash);
  const cachedPdf = input.services.redis ? await input.services.redis.get<string>(cacheKey) : null;

  if (cachedPdf) {
    if (input.projectId) {
      await LatexProjectModel.findByIdAndUpdate(input.projectId, {
        latex,
        lastCompiledHash: hash,
        lastCompiledAt: new Date()
      }).exec();
    }

    return {
      pdfBuffer: Buffer.from(cachedPdf, "base64"),
      hash,
      cacheHit: true
    };
  }

  const response = await fetch(env.LATEX_COMPILER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": env.LATEX_COMPILER_USER_AGENT,
      Referer: env.LATEX_COMPILER_REFERER,
      Origin: env.LATEX_COMPILER_ORIGIN,
      Accept: "*/*",
      "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
      DNT: "1"
    },
    body: JSON.stringify({ latex })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LaTeX compiler request failed: ${response.status} ${errorText}`);
  }

  const compilerJson = (await response.json()) as { success: boolean; pdf?: string; error?: string };

  if (!compilerJson.success || !compilerJson.pdf) {
    throw new Error(`LaTeX compiler error: ${compilerJson.error ?? "No PDF returned"}`);
  }

  const pdfBuffer = Buffer.from(compilerJson.pdf, "base64");

  if (input.services.redis) {
    await input.services.redis.set(cacheKey, pdfBuffer.toString("base64"), {
      ex: env.LATEX_COMPILE_CACHE_TTL_SECONDS
    });
  }

  if (input.projectId) {
    await LatexProjectModel.findByIdAndUpdate(input.projectId, {
      latex,
      lastCompiledHash: hash,
      lastCompiledAt: new Date()
    }).exec();
  }

  return {
    pdfBuffer,
    hash,
    cacheHit: false
  };
}

export async function assistLatexProject(input: AssistInput) {
  const project = await LatexProjectModel.findById(input.projectId);

  if (!project) {
    throw new Error("Project not found");
  }

  const activeLatex = typeof input.latex === "string" ? input.latex : project.latex;
  project.latex = activeLatex;

  const assistantResult = await generateLatexAssistResult({
    title: project.title,
    latex: activeLatex,
    userPrompt: input.prompt,
    selection: input.selection,
    cursorLine: input.cursorLine,
    cursorColumn: input.cursorColumn,
    history: (project.assistantHistory ?? []).map((entry: any) => ({
      role: entry.role,
      content: entry.content
    }))
  });

  project.latex = assistantResult.updatedLatex;
  project.lastAssistantSummary = assistantResult.summary;
  project.assistantHistory.push(
    {
      role: "user",
      content: input.prompt,
      createdAt: new Date()
    },
    {
      role: "assistant",
      content: assistantResult.explanation,
      summary: assistantResult.summary,
      createdAt: new Date()
    }
  );

  await project.save();

  return {
    project: normalizeProject(project.toObject()),
    assistant: assistantResult
  };
}