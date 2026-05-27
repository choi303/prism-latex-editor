type LatexAssistantPromptInput = {
  title: string;
  latex: string;
  userPrompt: string;
  selection?: string;
  cursorLine?: number;
  cursorColumn?: number;
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
};

export const defaultLatexDocument = String.raw`\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,amssymb,booktabs,array}
\usepackage{graphicx}
\usepackage{hyperref}

\title{Prism LaTeX Draft}
\author{AI Workspace}
\date{\today}

\begin{document}
\maketitle

\section{Introduction}
This document is ready for AI-assisted editing, compiling, and previewing.

\section{Example Formula}
\[
E = mc^2
\]

\end{document}
`;

export function buildLatexAssistantMessages(input: LatexAssistantPromptInput) {
  const historyBlock = input.history.slice(-8).map((entry) => ({
    role: entry.role,
    content: entry.content
  }));

  return [
    {
      role: "system",
      content: [
        "You are Prism LaTeX Copilot. You rewrite the full LaTeX document in response to user commands.",
        "Always keep the document compilable unless the user explicitly asks for a broken example.",
        "Never return markdown fences, commentary, or prose outside the JSON object.",
        "Return strict JSON with this exact shape:",
        '{"updatedLatex":"<full latex document>","summary":"<one sentence>","explanation":"<short explanation>","diagnostics":[{"line":12,"message":"Optional note"}]}',
        "If the user asks to insert or fix content at a location, apply it directly inside updatedLatex.",
        "Prefer minimal safe edits. Preserve user content, packages, and structure unless the request requires a change.",
        "If you add tables, equations, or environments, include required packages only when necessary.",
        "If a formula or environment is invalid, repair it and mention the repair in summary and explanation."
      ].join("\n")
    },
    ...historyBlock,
    {
      role: "user",
      content: [
        `Project title: ${input.title}`,
        `User request: ${input.userPrompt}`,
        `Cursor line: ${input.cursorLine ?? "unknown"}`,
        `Cursor column: ${input.cursorColumn ?? "unknown"}`,
        "Selected snippet:",
        input.selection?.trim() || "<none>",
        "Current LaTeX document:",
        input.latex
      ].join("\n\n")
    }
  ];
}