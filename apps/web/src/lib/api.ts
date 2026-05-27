const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/v1";

type ApiEnvelope<T> = {
  data: T;
};

type ApiErrorEnvelope = {
  error?: unknown;
};

export type LatexAssistantTurn = {
  role: "user" | "assistant" | "system";
  content: string;
  summary?: string;
  createdAt: string;
};

export type LatexProjectSummary = {
  id: string;
  title: string;
  updatedAt: string;
  lastCompiledAt: string | null;
  lastCompiledHash: string | null;
};

export type LatexProject = LatexProjectSummary & {
  createdAt: string;
  latex: string;
  lastAssistantSummary: string;
  assistantHistory: LatexAssistantTurn[];
};

export type LatexAssistResult = {
  project: LatexProject;
  assistant: {
    updatedLatex: string;
    summary: string;
    explanation: string;
    diagnostics: Array<{
      line?: number;
      message: string;
    }>;
  };
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
    throw new Error(typeof payload?.error === "string" ? payload.error : `Request failed with status ${response.status}`);
  }

  return (await response.json()) as ApiEnvelope<T>;
}

async function requestBinary(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorEnvelope | null;
    throw new Error(typeof payload?.error === "string" ? payload.error : `Request failed with status ${response.status}`);
  }

  return {
    blob: await response.blob(),
    hash: response.headers.get("x-compile-hash"),
    cacheHit: response.headers.get("x-compile-cache") === "HIT"
  };
}

export async function listLatexProjects() {
  const response = await request<LatexProjectSummary[]>("/latex/projects");
  return response.data;
}

export async function createLatexProject(input: { title?: string; latex?: string }) {
  const response = await request<LatexProject>("/latex/projects", {
    method: "POST",
    body: JSON.stringify(input)
  });

  return response.data;
}

export async function getLatexProject(projectId: string) {
  const response = await request<LatexProject>(`/latex/projects/${projectId}`);
  return response.data;
}

export async function deleteLatexProject(projectId: string) {
  const response = await request<{ id: string }>(`/latex/projects/${projectId}`, {
    method: "DELETE"
  });
  return response.data;
}

export async function updateLatexProject(input: { projectId: string; title?: string; latex?: string }) {
  const response = await request<LatexProject>(`/latex/projects/${input.projectId}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: input.title,
      latex: input.latex
    })
  });

  return response.data;
}

export async function compileLatexDocument(input: { latex: string; projectId?: string }) {
  return requestBinary("/latex/compile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
}

export async function assistLatexProject(input: {
  projectId: string;
  prompt: string;
  latex?: string;
  selection?: string;
  cursorLine?: number;
  cursorColumn?: number;
}) {
  const response = await request<LatexAssistResult>(`/latex/projects/${input.projectId}/assist`, {
    method: "POST",
    body: JSON.stringify({
      prompt: input.prompt,
      latex: input.latex,
      selection: input.selection,
      cursorLine: input.cursorLine,
      cursorColumn: input.cursorColumn
    })
  });

  return response.data;
}