"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Editor, { type BeforeMount, type OnMount, type Monaco } from "@monaco-editor/react";
import {
  AlertCircle,
  AlignLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  Command,
  Copy,
  Download,
  FileCode2,
  Files,
  FileText,
  GitBranch,
  Info,
  Layers,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Pencil,
  Pin,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Star,
  Terminal,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import {
  assistLatexProject,
  compileLatexDocument,
  createLatexProject,
  deleteLatexProject,
  getLatexProject,
  listLatexProjects,
  updateLatexProject,
  type LatexAssistantTurn,
  type LatexProjectSummary,
} from "@/lib/api";

type Toast = { id: string; type: "success" | "error" | "info" | "warning"; message: string };
type TexError = { line: number; message: string; type: "error" | "warning" };
type OutlineItem = { level: 1 | 2 | 3; label: string; line: number };
type CompileRecord = { hash: string; elapsed: number; ts: number; cacheHit: boolean };
type SortMode = "name" | "recent" | "size";
type Theme = "vs-dark" | "hc-black" | "vs";
type ContextMenuState = { x: number; y: number; projectId: string; title: string } | null;
type CommandItem = { id: string; label: string; icon: ReactNode; kbd?: string; group: string; action: () => void };
type RightDockTab = "outline" | "dock" | "preview";
type SmartChecklistItem = { id: string; label: string; done: boolean };
type CompileBlocker = { line: number; message: string };

const ZOOM_STEPS = [0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const DEFAULT_ZOOM_INDEX = 5;
const PANEL_HEIGHT_KEY = "prism:panel-height";
const FAVORITES_KEY = "prism:favorites";
const FONT_SIZE_KEY = "prism:font-size";
const THEME_KEY = "prism:theme";
const WORD_GOAL_KEY = "prism:word-goal";
const SORT_KEY = "prism:sort";
const PINNED_KEY = "prism:pinned-projects";
const RECENT_KEY = "prism:recent-projects";
const DRAFT_KEY_PREFIX = "prism:draft:";
const APPLE_SHELL = {
  appBg: "#f5f5f7",
  panelBg: "rgba(255,255,255,0.88)",
  panelStrong: "#ffffff",
  panelMuted: "#f0f1f5",
  border: "rgba(15,23,42,0.08)",
  borderStrong: "rgba(15,23,42,0.14)",
  text: "#111111",
  textMuted: "#6e6e73",
  accent: "#0071e3",
  accentSoft: "linear-gradient(135deg, rgba(0,113,227,0.12), rgba(131,56,236,0.1), rgba(255,45,85,0.08))",
  blackButton: "#111111",
  success: "#16a34a",
  warning: "#b7791f",
  danger: "#d92d20",
  shadow: "0 18px 50px rgba(15, 23, 42, 0.10)",
};

const TEMPLATES: Record<string, { label: string; desc: string; latex: string }> = {
  blank: {
    label: "Blank",
    desc: "Empty document",
    latex: "\\documentclass{article}\n\\begin{document}\n\n\\end{document}",
  },
  article: {
    label: "Article",
    desc: "Standard article with abstract",
    latex: "\\documentclass[12pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath,amssymb}\n\\usepackage{graphicx}\n\n\\title{Title}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\n\\begin{abstract}\nAbstract here.\n\\end{abstract}\n\n\\section{Introduction}\nContent here.\n\n\\end{document}",
  },
  report: {
    label: "Report",
    desc: "Long-form technical report",
    latex: "\\documentclass[12pt,a4paper]{report}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{graphicx}\n\n\\title{Report Title}\n\\author{Author Name}\n\\date{\\today}\n\n\\begin{document}\n\\maketitle\n\\tableofcontents\n\n\\chapter{Introduction}\nIntroduction chapter.\n\n\\chapter{Main Content}\nMain content here.\n\n\\end{document}",
  },
  beamer: {
    label: "Beamer",
    desc: "Presentation slides",
    latex: "\\documentclass{beamer}\n\\usetheme{Madrid}\n\n\\title{Presentation Title}\n\\author{Author}\n\\date{\\today}\n\n\\begin{document}\n\\begin{frame}\n\\titlepage\n\\end{frame}\n\n\\begin{frame}{Introduction}\n\\begin{itemize}\n  \\item First point\n  \\item Second point\n\\end{itemize}\n\\end{frame}\n\n\\end{document}",
  },
  letter: {
    label: "Letter",
    desc: "Formal letter",
    latex: "\\documentclass{letter}\n\\usepackage[utf8]{inputenc}\n\n\\begin{document}\n\\begin{letter}{Recipient Name \\\\ Address Line 1 \\\\ City, Country}\n\\opening{Dear Sir/Madam,}\n\nLetter body here.\n\n\\closing{Yours sincerely,}\n\\end{letter}\n\\end{document}",
  },
};

const ASSISTANT_SUGGESTIONS = [
  "Add a 3-column comparison table under the introduction.",
  "Fix formula issues and make compile-safe.",
  "Rewrite the abstract more academically.",
  "Insert a bibliography section at the end.",
  "Add a numbered list of equations with labels.",
  "Convert inline math to display equations.",
  "Add a title page with a subtitle and date.",
  "Convert this into IEEE paper style.",
];

const LATEX_SNIPPETS = [
  { label: "\\begin{...}", insertText: "\\begin{${1:itemize}}\n\t\\item ${2:first item}\n\\end{${1:itemize}}", doc: "Environment" },
  { label: "\\section{...}", insertText: "\\section{${1:title}}", doc: "Section heading" },
  { label: "\\subsection{...}", insertText: "\\subsection{${1:title}}", doc: "Subsection heading" },
  { label: "\\subsubsection{...}", insertText: "\\subsubsection{${1:title}}", doc: "Subsubsection heading" },
  { label: "\\textbf{...}", insertText: "\\textbf{${1:text}}", doc: "Bold text" },
  { label: "\\textit{...}", insertText: "\\textit{${1:text}}", doc: "Italic text" },
  { label: "\\emph{...}", insertText: "\\emph{${1:text}}", doc: "Emphasized text" },
  { label: "\\underline{...}", insertText: "\\underline{${1:text}}", doc: "Underlined text" },
  { label: "\\textcolor{...}{...}", insertText: "\\textcolor{${1:color}}{${2:text}}", doc: "Color text" },
  { label: "\\usepackage{...}", insertText: "\\usepackage{${1:package}}", doc: "Import package" },
  { label: "\\label{...}", insertText: "\\label{${1:label}}", doc: "Define label" },
  { label: "\\ref{...}", insertText: "\\ref{${1:label}}", doc: "Reference label" },
  { label: "\\eqref{...}", insertText: "\\eqref{${1:label}}", doc: "Equation reference" },
  { label: "\\cite{...}", insertText: "\\cite{${1:key}}", doc: "Citation" },
  { label: "\\footnote{...}", insertText: "\\footnote{${1:text}}", doc: "Footnote" },
  { label: "\\includegraphics{...}", insertText: "\\includegraphics[width=${1:0.8}\\linewidth]{${2:file}}", doc: "Include image" },
  { label: "equation", insertText: "\\begin{equation}\n\t${1:formula}\n\\end{equation}", doc: "Equation env" },
  { label: "equation*", insertText: "\\begin{equation*}\n\t${1:formula}\n\\end{equation*}", doc: "Unnumbered equation" },
  { label: "align", insertText: "\\begin{align}\n\t${1:a} &= ${2:b} \\\\\\\n\\end{align}", doc: "Align env" },
  { label: "itemize", insertText: "\\begin{itemize}\n\t\\item ${1:first}\n\\end{itemize}", doc: "Bullet list" },
  { label: "enumerate", insertText: "\\begin{enumerate}\n\t\\item ${1:first}\n\\end{enumerate}", doc: "Numbered list" },
  { label: "figure", insertText: "\\begin{figure}[h]\n\t\\centering\n\t\\includegraphics[width=0.8\\linewidth]{${1:file}}\n\t\\caption{${2:caption}}\n\t\\label{fig:${3:label}}\n\\end{figure}", doc: "Figure env" },
  { label: "table", insertText: "\\begin{table}[h]\n\t\\centering\n\t\\begin{tabular}{${1:ll}}\n\t\t\\hline\n\t\t${2:A} & ${3:B} \\\\\\\n\t\t\\hline\n\t\\end{tabular}\n\t\\caption{${4:caption}}\n\t\\label{tab:${5:label}}\n\\end{table}", doc: "Table env" },
  { label: "abstract", insertText: "\\begin{abstract}\n${1:text}\n\\end{abstract}", doc: "Abstract env" },
  { label: "proof", insertText: "\\begin{proof}\n${1:proof here.}\n\\end{proof}", doc: "Proof env" },
];

function snapshotProject(title: string, latex: string) {
  return JSON.stringify({ title, latex });
}

function parseTexErrors(errorText: string): TexError[] {
  const errors: TexError[] = [];
  const lineRegex = /l\.(\d+)\s+(.+)/g;
  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(errorText)) !== null) {
    errors.push({ line: parseInt(match[1], 10), message: match[2].trim().slice(0, 120), type: "error" });
  }
  const bangRegex = /!\s+(?:LaTeX Error:|Error:)?\s*(.+)/g;
  while ((match = bangRegex.exec(errorText)) !== null) {
    const msg = match[1].trim().slice(0, 120);
    if (!errors.some((entry) => entry.message.startsWith(msg.slice(0, 20)))) {
      errors.push({ line: 0, message: msg, type: "error" });
    }
  }
  const warnRegex = /LaTeX Warning:\s*(.+)/g;
  while ((match = warnRegex.exec(errorText)) !== null) {
    errors.push({ line: 0, message: match[1].trim().slice(0, 120), type: "warning" });
  }
  return errors.slice(0, 12);
}

function parseOutline(latex: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const lines = latex.split("\n");
  const regex = /^\\(section|subsection|subsubsection)\*?\{([^}]+)\}/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(latex)) !== null) {
    const before = latex.slice(0, match.index);
    const line = before.split("\n").length;
    items.push({
      level: match[1] === "section" ? 1 : match[1] === "subsection" ? 2 : 3,
      label: match[2].trim(),
      line,
    });
  }
  return items.filter((item) => item.line <= lines.length);
}

function wordCount(text: string) {
  return text.match(/\b\w+\b/g)?.length ?? 0;
}

function formatBytes(n: number) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function formatDuration(ms: number) {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function loadFavorites() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function saveFavorites(favorites: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
}

function loadStoredSet(key: string) {
  if (typeof window === "undefined") return new Set<string>();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set<string>();
  }
}

function saveStoredSet(key: string, values: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(values)));
}

function loadRecentProjects() {
  if (typeof window === "undefined") return [] as string[];
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [] as string[];
  }
}

function saveRecentProjects(projectIds: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(projectIds.slice(0, 8)));
}

function draftStorageKey(projectId: string) {
  return `${DRAFT_KEY_PREFIX}${projectId}`;
}

function countMatches(text: string, query: string) {
  if (!query.trim()) return 0;
  return text.toLowerCase().split(query.toLowerCase()).length - 1;
}

function findCompileBlockers(latex: string): CompileBlocker[] {
  const blockers: CompileBlocker[] = [];
  const patterns: Array<{ regex: RegExp; message: string }> = [
    { regex: /\\begin\{env\}|\\end\{env\}/, message: "Replace placeholder environment 'env' with a real LaTeX environment such as itemize, align or equation." },
    { regex: /\\usepackage\{package\}/, message: "Replace placeholder package name before compiling." },
    { regex: /\\includegraphics(?:\[[^\]]*\])?\{file\}/, message: "Replace placeholder image file name before compiling." },
    { regex: /\\label\{label\}|\\ref\{label\}|\\eqref\{label\}|\\cite\{key\}/, message: "Replace placeholder labels or citation keys before compiling." },
  ];

  const lines = latex.split("\n");
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        blockers.push({ line: index + 1, message: pattern.message });
        break;
      }
    }
  });

  return blockers.slice(0, 8);
}

function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const palette: Record<Toast["type"], { bg: string; border: string; text: string }> = {
    success: { bg: "rgba(240,253,244,0.96)", border: "#86efac", text: "#166534" },
    error: { bg: "rgba(254,242,242,0.96)", border: "#fda4af", text: "#b42318" },
    info: { bg: "rgba(239,246,255,0.96)", border: "#93c5fd", text: "#1d4ed8" },
    warning: { bg: "rgba(255,251,235,0.98)", border: "#fcd34d", text: "#a16207" },
  };

  return (
    <div className="fixed bottom-8 right-4 z-[60] flex flex-col gap-2" style={{ pointerEvents: "none", maxWidth: 360 }}>
      {toasts.map((toast) => {
        const c = palette[toast.type];
        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            style={{
              pointerEvents: "all",
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: c.text,
              borderRadius: 18,
              padding: "10px 14px",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              boxShadow: APPLE_SHELL.shadow,
              backdropFilter: "blur(18px)",
            }}
          >
            {toast.type === "success" && <Check style={{ width: 12, height: 12, flexShrink: 0 }} />}
            {(toast.type === "error" || toast.type === "warning") && <AlertCircle style={{ width: 12, height: 12, flexShrink: 0 }} />}
            {toast.type === "info" && <Info style={{ width: 12, height: 12, flexShrink: 0 }} />}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <X style={{ width: 10, height: 10, flexShrink: 0, opacity: 0.5 }} />
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ active }: { active: boolean }) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (active) {
      const frame = window.requestAnimationFrame(() => setWidth(24));
      const timeout = window.setTimeout(() => setWidth(76), 180);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timeout);
      };
    }
    const frame = window.requestAnimationFrame(() => setWidth(100));
    const timeout = window.setTimeout(() => setWidth(0), 260);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [active]);

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[100] h-[2px] w-full">
      <div
        style={{
          width: `${width}%`,
          height: "100%",
          background: "linear-gradient(90deg, #007acc, #4ec9b0)",
          opacity: width === 0 ? 0 : 1,
          transition: active ? "width 2s ease" : "width 0.3s ease",
        }}
      />
    </div>
  );
}

function ShortcutModal({ onClose }: { onClose: () => void }) {
  const groups = [
    {
      title: "Editor",
      items: [
        { keys: "Ctrl + Shift + B", action: "Compile LaTeX" },
        { keys: "Ctrl + S", action: "Save immediately" },
        { keys: "Ctrl + `", action: "Focus AI input" },
        { keys: "Ctrl + P", action: "Open command palette" },
      ],
    },
    {
      title: "Layout",
      items: [
        { keys: "Ctrl + B", action: "Toggle sidebar" },
        { keys: "Ctrl + Shift + O", action: "Toggle outline" },
        { keys: "F11", action: "Toggle zen mode" },
        { keys: "F1", action: "Show shortcuts" },
      ],
    },
    {
      title: "Assistant",
      items: [
        { keys: "Ctrl + Enter", action: "Send AI message" },
        { keys: "↑ / ↓", action: "Prompt history" },
        { keys: "Escape", action: "Blur AI input" },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.18)", backdropFilter: "blur(16px)" }} onClick={onClose}>
      <div style={{ background: "rgba(255,255,255,0.9)", border: `1px solid ${APPLE_SHELL.border}`, borderRadius: 28, padding: "24px 28px", minWidth: 460, maxHeight: "80vh", overflowY: "auto", boxShadow: APPLE_SHELL.shadow }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <span style={{ color: APPLE_SHELL.text, fontSize: 14, fontWeight: 600 }}>Keyboard Shortcuts</span>
          <button onClick={onClose} className="rounded-full p-2" style={{ color: APPLE_SHELL.textMuted, background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}><X className="h-4 w-4" /></button>
        </div>
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <div className="mb-2 text-[10px] uppercase tracking-widest" style={{ color: APPLE_SHELL.accent }}>{group.title}</div>
            <div className="flex flex-col gap-2">
              {group.items.map((item) => (
                <div key={item.keys} className="flex items-center justify-between gap-8">
                  <span style={{ color: APPLE_SHELL.textMuted, fontSize: 12 }}>{item.action}</span>
                  <kbd style={{ background: "#f3f4f6", color: APPLE_SHELL.text, borderRadius: 999, padding: "4px 10px", fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap", border: `1px solid ${APPLE_SHELL.border}` }}>{item.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandPalette({ commands, onClose }: { commands: CommandItem[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((item) => item.label.toLowerCase().includes(q) || item.group.toLowerCase().includes(q));
  }, [commands, query]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      onClose();
    }
    if (event.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16" style={{ background: "rgba(15,23,42,0.16)", backdropFilter: "blur(14px)" }} onClick={onClose}>
      <div style={{ background: "rgba(255,255,255,0.94)", border: `1px solid ${APPLE_SHELL.border}`, borderRadius: 28, width: 560, maxHeight: 440, overflow: "hidden", boxShadow: APPLE_SHELL.shadow }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderBottomColor: APPLE_SHELL.border }}>
          <Search className="h-4 w-4 shrink-0" style={{ color: APPLE_SHELL.textMuted }} />
          <input ref={inputRef} value={query} onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }} onKeyDown={handleKeyDown} placeholder="Type a command..." className="flex-1 bg-transparent text-sm outline-none" style={{ color: APPLE_SHELL.text }} />
          <kbd style={{ background: "#f3f4f6", color: APPLE_SHELL.textMuted, borderRadius: 999, padding: "3px 8px", fontSize: 10, border: `1px solid ${APPLE_SHELL.border}` }}>Esc</kbd>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
          {filtered.map((command, index) => (
            <button
              key={command.id}
              onClick={() => {
                command.action();
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-xs transition-colors"
              style={{ background: selectedIndex === index ? "linear-gradient(135deg, #111111, #2b2b2f)" : "transparent", color: selectedIndex === index ? "#ffffff" : APPLE_SHELL.text }}
            >
              <span className="shrink-0" style={{ color: selectedIndex === index ? "#ffffff" : APPLE_SHELL.textMuted }}>{command.icon}</span>
              <span className="flex-1">{command.label}</span>
              {command.kbd && <kbd style={{ background: selectedIndex === index ? "rgba(255,255,255,0.14)" : "#f3f4f6", color: selectedIndex === index ? "#ffffff" : APPLE_SHELL.textMuted, borderRadius: 999, padding: "2px 8px", fontSize: 10 }}>{command.kbd}</kbd>}
            </button>
          ))}
          {filtered.length === 0 && <div className="px-4 py-6 text-center text-xs" style={{ color: APPLE_SHELL.textMuted }}>No commands match “{query}”</div>}
        </div>
      </div>
    </div>
  );
}

function TemplatesModal({ onClose, onSelect }: { onClose: () => void; onSelect: (latex: string, title: string) => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof TEMPLATES>("article");
  const template = TEMPLATES[selectedTemplate];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.18)", backdropFilter: "blur(16px)" }} onClick={onClose}>
      <div style={{ background: "rgba(255,255,255,0.95)", border: `1px solid ${APPLE_SHELL.border}`, borderRadius: 30, width: 680, maxHeight: "80vh", overflow: "hidden", boxShadow: APPLE_SHELL.shadow }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderBottomColor: APPLE_SHELL.border }}>
          <span style={{ color: APPLE_SHELL.text, fontSize: 14, fontWeight: 600 }}>Create from Template</span>
          <button onClick={onClose} className="rounded-full p-2" style={{ color: APPLE_SHELL.textMuted, background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex" style={{ height: 420 }}>
          <div className="flex w-[220px] flex-col gap-2 overflow-y-auto border-r p-3" style={{ borderRightColor: APPLE_SHELL.border, background: "#f8f9fb" }}>
            {Object.entries(TEMPLATES).map(([key, item]) => (
              <button
                key={key}
                onClick={() => setSelectedTemplate(key as keyof typeof TEMPLATES)}
                className="rounded-[18px] px-3 py-3 text-left text-xs transition-colors"
                style={{ background: selectedTemplate === key ? "linear-gradient(135deg, #111111, #2f2f32)" : "#ffffff", color: selectedTemplate === key ? "#ffffff" : APPLE_SHELL.text, border: `1px solid ${selectedTemplate === key ? "#111111" : APPLE_SHELL.border}` }}
              >
                <div className="font-medium">{item.label}</div>
                <div className="mt-0.5 text-[10px]" style={{ color: selectedTemplate === key ? "rgba(255,255,255,0.72)" : APPLE_SHELL.textMuted }}>{item.desc}</div>
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4" style={{ background: "#ffffff" }}>
            <pre style={{ color: APPLE_SHELL.text, fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{template.latex}</pre>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-4" style={{ borderTopColor: APPLE_SHELL.border }}>
          <button onClick={onClose} className="rounded-full px-4 py-2 text-xs" style={{ color: APPLE_SHELL.textMuted, background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}>Cancel</button>
          <button onClick={() => onSelect(template.latex, template.label)} className="rounded-full px-4 py-2 text-xs font-medium" style={{ background: APPLE_SHELL.blackButton, color: "#fff" }}>Create Project</button>
        </div>
      </div>
    </div>
  );
}

function ContextMenu({
  state,
  isFavorite,
  onClose,
  onDelete,
  onDuplicate,
  onFavorite,
  onRename,
}: {
  state: NonNullable<ContextMenuState>;
  isFavorite: boolean;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onFavorite: () => void;
  onRename: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);

  return (
    <div style={{ position: "fixed", left: state.x, top: state.y, background: "rgba(255,255,255,0.94)", border: `1px solid ${APPLE_SHELL.border}`, borderRadius: 22, zIndex: 200, minWidth: 220, boxShadow: APPLE_SHELL.shadow, padding: "8px" }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="px-3 py-2 text-[10px]" style={{ color: APPLE_SHELL.textMuted }}>{state.title}</div>
      <div style={{ borderTop: `1px solid ${APPLE_SHELL.border}`, margin: "4px 0" }} />
      <button onClick={() => { onRename(); onClose(); }} className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left text-xs" style={{ color: APPLE_SHELL.text }}><Pencil className="h-3 w-3" />Rename</button>
      <button onClick={() => { onDuplicate(); onClose(); }} className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left text-xs" style={{ color: APPLE_SHELL.text }}><Copy className="h-3 w-3" />Duplicate</button>
      <button onClick={() => { onFavorite(); onClose(); }} className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left text-xs" style={{ color: APPLE_SHELL.text }}><Star className="h-3 w-3" />{isFavorite ? "Remove from favorites" : "Add to favorites"}</button>
      <div style={{ borderTop: `1px solid ${APPLE_SHELL.border}`, margin: "4px 0" }} />
      <button onClick={() => { onDelete(); onClose(); }} className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-left text-xs" style={{ color: APPLE_SHELL.danger }}><Trash2 className="h-3 w-3" />Delete</button>
    </div>
  );
}

function OutlinePanel({ currentLine, items, onJump }: { currentLine: number; items: OutlineItem[]; onJump: (line: number) => void }) {
  if (items.length === 0) {
    return <div className="px-4 py-4 text-xs" style={{ color: APPLE_SHELL.textMuted }}>Add sections to build an outline.</div>;
  }

  return (
    <div className="flex flex-col overflow-y-auto py-2">
      {items.map((item, index) => {
        const next = items[index + 1];
        const active = currentLine >= item.line && (!next || currentLine < next.line);
        return (
          <button
            key={`${item.line}-${item.label}`}
            onClick={() => onJump(item.line)}
            className="mx-2 flex items-center gap-1 rounded-[14px] py-1.5 text-left text-xs transition-colors"
            style={{ paddingLeft: 10 + (item.level - 1) * 12, color: active ? APPLE_SHELL.text : item.level === 1 ? APPLE_SHELL.text : APPLE_SHELL.textMuted, background: active ? "linear-gradient(135deg, rgba(0,113,227,0.12), rgba(120,119,198,0.08))" : "transparent" }}
          >
            {item.level === 1 ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" />}
            <span className="truncate">{item.label}</span>
              <span className="ml-auto pr-2 text-[10px]" style={{ color: APPLE_SHELL.textMuted }}>L{item.line}</span>
          </button>
        );
      })}
    </div>
  );
}

function WordGoalBar({ current, goal, onChange }: { current: number; goal: number; onChange: (value: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(goal));
  const percentage = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0;

  return (
    <div className="border-t px-3 py-2" style={{ borderTopColor: "#3e3e3e" }}>
      <div className="mb-1 flex items-center justify-between text-[10px]" style={{ color: "#858585" }}>
        <span>Word Goal</span>
        {editing ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => {
              const next = parseInt(value, 10);
              if (next > 0) onChange(next);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const next = parseInt(value, 10);
                if (next > 0) onChange(next);
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-16 rounded px-1 text-[10px] outline-none"
            style={{ background: "#3c3c3c", color: "#cccccc", border: "1px solid #007acc" }}
          />
        ) : (
          <button onClick={() => { setValue(String(goal)); setEditing(true); }} className="hover:text-white">{current} / {goal} ({percentage}%)</button>
        )}
      </div>
      <div style={{ height: 3, background: "#3c3c3c", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${percentage}%`, height: "100%", background: percentage >= 100 ? "#4ec9b0" : "#007acc", transition: "width 0.25s ease" }} />
      </div>
    </div>
  );
}

function CompileHistoryDropdown({ onClose, records }: { onClose: () => void; records: CompileRecord[] }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [onClose]);

  if (records.length === 0) return null;

  return (
    <div style={{ position: "absolute", top: "100%", right: 0, background: "#252526", border: "1px solid #454545", borderRadius: 4, zIndex: 50, minWidth: 220, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "4px 0" }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="px-3 py-1 text-[10px] uppercase tracking-widest" style={{ color: "#569cd6" }}>Compile History</div>
      {records.map((record) => (
        <div key={`${record.hash}-${record.ts}`} className="flex items-center gap-3 px-3 py-1.5 text-[11px]" style={{ color: "#cccccc" }}>
          <span style={{ color: record.cacheHit ? "#4ec9b0" : "#858585" }}>{record.cacheHit ? "⚡" : "✓"}</span>
          <span className="flex-1">{record.hash.slice(0, 8)}</span>
          <span style={{ color: "#858585" }}>{formatDuration(record.elapsed)}</span>
          <span style={{ color: "#555555" }}>{new Date(record.ts).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  );
}

function InsightStat({ label, value, accent, hint }: { label: string; value: string; accent: string; hint: string }) {
  return (
    <div className="rounded border px-3 py-2" style={{ borderColor: "#2d2d2d", background: "#252526" }}>
      <div className="text-[10px] uppercase tracking-widest" style={{ color: accent }}>{label}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color: "#ffffff" }}>{value}</div>
      <div className="mt-0.5 text-[10px]" style={{ color: "#858585" }}>{hint}</div>
    </div>
  );
}

function SmartDock({
  checklist,
  currentSection,
  latestSummary,
  onInsertSnippet,
  onJump,
  onToggleChecklist,
  outlineItems,
  quickStats,
}: {
  checklist: SmartChecklistItem[];
  currentSection: string;
  latestSummary: string;
  onInsertSnippet: (snippet: (typeof LATEX_SNIPPETS)[number]) => void;
  onJump: (line: number) => void;
  onToggleChecklist: (itemId: string) => void;
  outlineItems: OutlineItem[];
  quickStats: Array<{ label: string; value: string; accent: string; hint: string }>;
}) {
  const quickSnippets = LATEX_SNIPPETS.slice(0, 6);
  const nextStops = outlineItems.slice(0, 5);

  return (
    <div className="flex w-[292px] shrink-0 flex-col overflow-hidden" style={{ background: "#202225", borderLeft: "1px solid #2d2d2d" }}>
      <div className="border-b px-4 py-3" style={{ borderBottomColor: "#2d2d2d" }}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#9cdcfe" }}>Smart Dock</div>
        <div className="mt-1 text-xs" style={{ color: "#cccccc" }}>{currentSection || "No active section"}</div>
        <div className="mt-1 text-[10px]" style={{ color: "#858585" }}>Context, checklists and fast insert tools stay visible here.</div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          {quickStats.map((item) => (
            <InsightStat key={item.label} label={item.label} value={item.value} accent={item.accent} hint={item.hint} />
          ))}
        </div>

        <section className="mt-3 rounded border p-3" style={{ borderColor: "#2d2d2d", background: "#252526" }}>
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#dcdcaa" }}>Writing Checklist</div>
            <div className="text-[10px]" style={{ color: "#858585" }}>{checklist.filter((item) => item.done).length}/{checklist.length}</div>
          </div>
          <div className="mt-2 grid gap-1.5">
            {checklist.map((item) => (
              <button key={item.id} onClick={() => onToggleChecklist(item.id)} className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-[#2d2d2d]" style={{ color: item.done ? "#4ec9b0" : "#cccccc" }}>
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px]" style={{ background: item.done ? "#4ec9b0" : "#3c3c3c", color: item.done ? "#1e1e1e" : "#858585" }}>{item.done ? "✓" : "•"}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded border p-3" style={{ borderColor: "#2d2d2d", background: "#252526" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#ce9178" }}>Quick Insert</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {quickSnippets.map((snippet) => (
              <button key={snippet.label} onClick={() => onInsertSnippet(snippet)} className="rounded px-2 py-1 text-[10px] hover:bg-[#2d2d2d]" style={{ background: "#1e1e1e", color: "#cccccc", border: "1px solid #333333" }}>
                {snippet.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded border p-3" style={{ borderColor: "#2d2d2d", background: "#252526" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#4ec9b0" }}>Section Radar</div>
          <div className="mt-2 grid gap-1.5">
            {nextStops.length === 0 ? (
              <div className="text-[11px]" style={{ color: "#858585" }}>Add sections to populate navigation hotspots.</div>
            ) : (
              nextStops.map((item) => (
                <button key={`${item.line}-${item.label}`} onClick={() => onJump(item.line)} className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-[#2d2d2d]" style={{ color: currentSection === item.label ? "#ffffff" : "#cccccc" }}>
                  <span className="rounded px-1 text-[10px]" style={{ background: "#1e1e1e", color: "#9cdcfe" }}>L{item.line}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="mt-3 rounded border p-3" style={{ borderColor: "#2d2d2d", background: "#252526" }}>
          <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#c586c0" }}>Latest AI Summary</div>
          <div className="mt-2 text-[11px] leading-5" style={{ color: latestSummary ? "#cccccc" : "#858585" }}>{latestSummary || "No assistant summary yet. Ask the AI to tighten, expand or refactor part of the paper."}</div>
        </section>
      </div>
    </div>
  );
}

function AICopilotPanel({
  assistantHistory,
  assistantPrompt,
  assistPending,
  latestSummary,
  panelError,
  showWordGoal,
  words,
  wordGoal,
  onWordGoalChange,
  onSetAssistantPrompt,
  onTextareaKeyDown,
  onAssist,
  onClearHistory,
  onCopyMessage,
  aiInputRef,
}: {
  assistantHistory: LatexAssistantTurn[];
  assistantPrompt: string;
  assistPending: boolean;
  latestSummary: string;
  panelError: Error | null;
  showWordGoal: boolean;
  words: number;
  wordGoal: number;
  onWordGoalChange: (value: number) => void;
  onSetAssistantPrompt: (value: string) => void;
  onTextareaKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAssist: () => void;
  onClearHistory: () => void;
  onCopyMessage: (content: string) => void;
  aiInputRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <div className="shrink-0 rounded-[28px] border" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(244,247,255,0.98))", borderColor: APPLE_SHELL.border, boxShadow: APPLE_SHELL.shadow }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderBottomColor: APPLE_SHELL.border }}>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: APPLE_SHELL.accent }}>AI Copilot</div>
          <div className="mt-1 text-sm font-semibold" style={{ color: APPLE_SHELL.text }}>Writing partner, not a console tab</div>
        </div>
        <div className="flex items-center gap-2">
          {latestSummary && <div className="max-w-[320px] truncate text-[11px]" style={{ color: APPLE_SHELL.textMuted }}>{latestSummary}</div>}
          {assistantHistory.length > 0 && <button onClick={onClearHistory} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.textMuted, border: `1px solid ${APPLE_SHELL.border}` }}>Clear</button>}
        </div>
      </div>

      <div className="grid gap-0" style={{ gridTemplateColumns: "1.2fr 0.8fr" }}>
        <div className="min-h-[184px] border-r px-4 py-3" style={{ borderRightColor: APPLE_SHELL.border }}>
          {assistantHistory.length === 0 && (
            <div className="mb-4">
              <div className="mb-2 text-[11px] font-medium" style={{ color: APPLE_SHELL.textMuted }}>Suggested prompts</div>
              <div className="flex flex-wrap gap-2">
                {ASSISTANT_SUGGESTIONS.slice(0, 4).map((suggestion) => (
                  <button key={suggestion} onClick={() => onSetAssistantPrompt(suggestion)} className="rounded-full px-3 py-1.5 text-[11px]" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.text, border: `1px solid ${APPLE_SHELL.border}` }}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {panelError && <div className="mb-3 rounded-[16px] px-3 py-2 text-xs" style={{ background: "#fff1ef", color: APPLE_SHELL.danger }}>{panelError.message.slice(0, 240)}</div>}
          <div className="max-h-[180px] overflow-y-auto pr-1">
            {assistantHistory.slice(-6).map((entry, index) => (
              <div key={`${entry.createdAt}-${index}`} className="mb-2 rounded-[18px] px-3 py-2" style={{ background: entry.role === "user" ? "#111111" : APPLE_SHELL.panelStrong, color: entry.role === "user" ? "#ffffff" : APPLE_SHELL.text, border: entry.role === "user" ? "1px solid #111111" : `1px solid ${APPLE_SHELL.border}` }}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: entry.role === "user" ? "rgba(255,255,255,0.66)" : APPLE_SHELL.textMuted }}>{entry.role === "user" ? "You" : "Copilot"}</span>
                  <button onClick={() => onCopyMessage(entry.content)} className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: entry.role === "user" ? "rgba(255,255,255,0.12)" : "#f3f4f6", color: entry.role === "user" ? "#ffffff" : APPLE_SHELL.textMuted }}>Copy</button>
                </div>
                <div className="text-xs leading-5">{entry.content}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between px-4 py-3" style={{ background: "rgba(248,250,255,0.9)" }}>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#7c3aed" }}>Prompt Composer</div>
            <div className="mt-1 text-[11px]" style={{ color: APPLE_SHELL.textMuted }}>Ask for rewrites, diagnostics, structure changes, or compile-safe fixes.</div>
          </div>
          <div className="mt-3">
            {showWordGoal && <WordGoalBar current={words} goal={wordGoal} onChange={onWordGoalChange} />}
            <div className="mt-3 rounded-[22px] border p-3" style={{ borderColor: APPLE_SHELL.border, background: APPLE_SHELL.panelStrong }}>
              <textarea ref={aiInputRef} value={assistantPrompt} onChange={(e) => onSetAssistantPrompt(e.target.value)} onKeyDown={onTextareaKeyDown} placeholder="Ask Copilot to refactor, explain, tighten, or fix compile issues..." rows={5} className="w-full resize-none bg-transparent text-sm outline-none" style={{ color: APPLE_SHELL.text, lineHeight: "20px" }} />
              <div className="mt-3 flex items-center justify-between">
                <div className="text-[11px]" style={{ color: APPLE_SHELL.textMuted }}>Ctrl+Enter to send</div>
                <button onClick={onAssist} disabled={!assistantPrompt.trim() || assistPending} className="rounded-full px-4 py-2 text-xs font-medium disabled:opacity-40" style={{ background: "linear-gradient(135deg, #111111, #2f2f32)", color: "#ffffff" }}>
                  {assistPending ? "Thinking..." : "Send to Copilot"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LatexWorkspace() {
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>(() => (typeof window === "undefined" ? "recent" : ((window.localStorage.getItem(SORT_KEY) as SortMode) ?? "recent")));
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites());
  const [pinnedProjects, setPinnedProjects] = useState<Set<string>>(() => loadStoredSet(PINNED_KEY));
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>(() => loadRecentProjects());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [zenMode, setZenMode] = useState(false);
  const [topLoading, setTopLoading] = useState(false);
  const didBootstrapRef = useRef(false);

  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = uid();
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const projectsQuery = useQuery({ queryKey: ["latex-projects"], queryFn: listLatexProjects });
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const activeProjectId = selectedProjectId ?? projects[0]?.id ?? null;

  const filteredProjects = useMemo(() => {
    let next = searchQuery.trim() ? projects.filter((project) => project.title.toLowerCase().includes(searchQuery.toLowerCase())) : [...projects];
    if (sortMode === "name") next = next.sort((a, b) => a.title.localeCompare(b.title));
    if (sortMode === "size") next = next.sort((a, b) => b.title.length - a.title.length);
    return [
      ...next.filter((project) => pinnedProjects.has(project.id)),
      ...next.filter((project) => !pinnedProjects.has(project.id) && favorites.has(project.id)),
      ...next.filter((project) => !pinnedProjects.has(project.id) && !favorites.has(project.id)),
    ];
  }, [favorites, pinnedProjects, projects, searchQuery, sortMode]);

  const recentProjects = useMemo(
    () => recentProjectIds.map((id) => projects.find((project) => project.id === id)).filter((project): project is LatexProjectSummary => Boolean(project)),
    [projects, recentProjectIds],
  );

  const activeProjectQuery = useQuery({
    queryKey: ["latex-project", activeProjectId],
    queryFn: () => getLatexProject(activeProjectId as string),
    enabled: Boolean(activeProjectId),
  });

  const createProjectMutation = useMutation({
    mutationFn: createLatexProject,
    onMutate: () => setTopLoading(true),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["latex-projects"] });
      queryClient.setQueryData(["latex-project", project.id], project);
      setSelectedProjectId(project.id);
      touchRecentProject(project.id);
      setTopLoading(false);
      addToast("success", `Created "${project.title}"`);
    },
    onError: () => {
      setTopLoading(false);
      addToast("error", "Failed to create project");
    },
  });

  const renameMutation = useMutation({
    mutationFn: updateLatexProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["latex-projects"] });
      queryClient.setQueryData(["latex-project", project.id], project);
      addToast("success", `Renamed to "${project.title}"`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLatexProject,
    onSuccess: (_data, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["latex-projects"] });
      queryClient.removeQueries({ queryKey: ["latex-project", projectId] });
      if (selectedProjectId === projectId) setSelectedProjectId(null);
      setDeletingId(null);
      addToast("info", "Project deleted");
    },
    onError: () => addToast("error", "Failed to delete project"),
  });

  useEffect(() => {
    function onMove(event: MouseEvent) {
      setSidebarWidth(Math.max(160, Math.min(420, event.clientX - 48)));
    }
    function onUp() {
      setIsDraggingSidebar(false);
    }
    if (isDraggingSidebar) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingSidebar]);

  useEffect(() => {
    if (projectsQuery.isLoading || projectsQuery.data === undefined) return;
    if (projectsQuery.data.length === 0 && !didBootstrapRef.current) {
      didBootstrapRef.current = true;
      void createProjectMutation.mutateAsync({});
    }
  }, [createProjectMutation, projectsQuery.data, projectsQuery.isLoading]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "F1") {
        event.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (event.key === "F11") {
        event.preventDefault();
        setZenMode((prev) => !prev);
      }
      if (event.ctrlKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setExplorerOpen((prev) => !prev);
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "o") {
        event.preventDefault();
        setOutlineOpen((prev) => !prev);
      }
      if (event.ctrlKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleFavorite(projectId: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      saveFavorites(next);
      return next;
    });
  }

  function togglePinned(projectId: string) {
    setPinnedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      saveStoredSet(PINNED_KEY, next);
      return next;
    });
  }

  function touchRecentProject(projectId: string) {
    setRecentProjectIds((prev) => {
      const next = [projectId, ...prev.filter((id) => id !== projectId)].slice(0, 8);
      saveRecentProjects(next);
      return next;
    });
  }

  function startRename(project: LatexProjectSummary) {
    setRenamingId(project.id);
    setRenamingValue(project.title);
  }

  async function commitRename(projectId: string) {
    const title = renamingValue.trim();
    if (title) await renameMutation.mutateAsync({ projectId, title });
    setRenamingId(null);
  }

  async function handleDuplicate(project: LatexProjectSummary) {
    const full = await getLatexProject(project.id);
    await createProjectMutation.mutateAsync({ title: `${project.title} (copy)`, latex: full.latex });
  }

  function handleRenameKey(event: React.KeyboardEvent, projectId: string) {
    if (event.key === "Enter") void commitRename(projectId);
    if (event.key === "Escape") setRenamingId(null);
  }

  function exportTex(latex: string, title: string) {
    const blob = new Blob([latex], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${title}.tex`;
    anchor.click();
    URL.revokeObjectURL(url);
    addToast("success", `Exported ${title}.tex`);
  }

  async function importTexFile() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".tex,.txt";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const title = file.name.replace(/\.tex$/i, "");
      await createProjectMutation.mutateAsync({ title, latex: text });
    };
    input.click();
  }

  const commands: CommandItem[] = [
    { id: "new-project", label: "New Blank Project", icon: <Plus className="h-3.5 w-3.5" />, group: "Projects", action: () => void createProjectMutation.mutateAsync({}) },
    { id: "new-template", label: "New Project from Template", icon: <Layers className="h-3.5 w-3.5" />, group: "Projects", action: () => setShowTemplates(true) },
    { id: "import", label: "Import .tex File", icon: <Upload className="h-3.5 w-3.5" />, group: "Projects", action: importTexFile },
    { id: "recent-first", label: "Sort Projects by Recent", icon: <RotateCcw className="h-3.5 w-3.5" />, group: "Projects", action: () => { setSortMode("recent"); if (typeof window !== "undefined") window.localStorage.setItem(SORT_KEY, "recent"); } },
    { id: "toggle-sidebar", label: "Toggle Sidebar", icon: <Files className="h-3.5 w-3.5" />, kbd: "Ctrl+B", group: "View", action: () => setExplorerOpen((prev) => !prev) },
    { id: "toggle-outline", label: "Toggle Outline", icon: <AlignLeft className="h-3.5 w-3.5" />, kbd: "Ctrl+Shift+O", group: "View", action: () => setOutlineOpen((prev) => !prev) },
    { id: "toggle-zen", label: zenMode ? "Exit Zen Mode" : "Enter Zen Mode", icon: <Maximize2 className="h-3.5 w-3.5" />, kbd: "F11", group: "View", action: () => setZenMode((prev) => !prev) },
    { id: "show-shortcuts", label: "Show Keyboard Shortcuts", icon: <Command className="h-3.5 w-3.5" />, kbd: "F1", group: "Help", action: () => setShowShortcuts(true) },
    { id: "sort-name", label: "Sort Projects by Name", icon: <AlignLeft className="h-3.5 w-3.5" />, group: "Projects", action: () => { setSortMode("name"); if (typeof window !== "undefined") window.localStorage.setItem(SORT_KEY, "name"); } },
    { id: "sort-recent", label: "Sort Projects by Recent", icon: <RefreshCw className="h-3.5 w-3.5" />, group: "Projects", action: () => { setSortMode("recent"); if (typeof window !== "undefined") window.localStorage.setItem(SORT_KEY, "recent"); } },
  ];

  return (
    <>
      <ProgressBar active={topLoading} />
      {showShortcuts && <ShortcutModal onClose={() => setShowShortcuts(false)} />}
      {showCommandPalette && <CommandPalette commands={commands} onClose={() => setShowCommandPalette(false)} />}
      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} onSelect={(latex, title) => { void createProjectMutation.mutateAsync({ latex, title }); setShowTemplates(false); }} />}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          isFavorite={favorites.has(contextMenu.projectId)}
          onClose={() => setContextMenu(null)}
          onDelete={() => setDeletingId(contextMenu.projectId)}
          onDuplicate={() => {
            const project = projects.find((entry) => entry.id === contextMenu.projectId);
            if (project) void handleDuplicate(project);
          }}
          onFavorite={() => toggleFavorite(contextMenu.projectId)}
          onRename={() => {
            const project = projects.find((entry) => entry.id === contextMenu.projectId);
            if (project) startRename(project);
          }}
        />
      )}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
      <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: `linear-gradient(180deg, ${APPLE_SHELL.appBg}, #eef2f8 68%, #f9fafb)`, color: APPLE_SHELL.text, fontFamily: "'SF Pro Display', 'SF Pro Text', 'Segoe UI', system-ui, sans-serif", fontSize: 13 }}>
        {!zenMode && (
          <div className="flex h-9 shrink-0 select-none items-center justify-between px-4 text-xs" style={{ background: "rgba(255,255,255,0.72)", color: APPLE_SHELL.text, borderBottom: `1px solid ${APPLE_SHELL.border}`, backdropFilter: "blur(18px)" }}>
            <div className="flex items-center gap-2">
              <span style={{ color: APPLE_SHELL.textMuted }}>prism</span>
              <span style={{ color: APPLE_SHELL.textMuted }}>—</span>
              <span>{activeProjectQuery.data?.title ?? "Loading..."}</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowCommandPalette(true)} title="Command palette (Ctrl+P)" className="flex items-center gap-1 rounded-full px-3 py-1 text-xs transition-colors" style={{ color: APPLE_SHELL.textMuted, background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}>
                <Command className="h-3 w-3" /> Ctrl+P
              </button>
              <button onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (F1)" className="rounded-full px-3 py-1 text-xs transition-colors" style={{ color: APPLE_SHELL.textMuted, background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}>F1</button>
              <Link href="/" className="text-xs transition-colors" style={{ color: APPLE_SHELL.textMuted }}>← back</Link>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {!zenMode && (
            <div className="m-3 mr-0 flex w-14 shrink-0 flex-col items-center rounded-[24px] pt-3" style={{ background: "rgba(255,255,255,0.72)", border: `1px solid ${APPLE_SHELL.border}`, boxShadow: APPLE_SHELL.shadow, backdropFilter: "blur(18px)" }}>
              <button onClick={() => setExplorerOpen((prev) => !prev)} title="Explorer (Ctrl+B)" className="relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors" style={{ color: explorerOpen ? "#ffffff" : APPLE_SHELL.textMuted, background: explorerOpen ? "linear-gradient(135deg, #111111, #2f2f32)" : "transparent" }}>
                <Files className="h-6 w-6" />
              </button>
              <button onClick={() => setOutlineOpen((prev) => !prev)} title="Outline (Ctrl+Shift+O)" className="mt-1 relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors" style={{ color: outlineOpen ? "#ffffff" : APPLE_SHELL.textMuted, background: outlineOpen ? "linear-gradient(135deg, #111111, #2f2f32)" : "transparent" }}>
                <BookOpen className="h-5 w-5" />
              </button>
              <button title="Search" className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl transition-colors" style={{ color: APPLE_SHELL.textMuted }}>
                <Search className="h-6 w-6" />
              </button>
              <button title="Source control" className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl transition-colors" style={{ color: APPLE_SHELL.textMuted }}>
                <GitBranch className="h-6 w-6" />
              </button>
              <div className="mt-auto mb-2 flex flex-col gap-1">
                <button onClick={() => setZenMode((prev) => !prev)} title="Zen mode (F11)" className="flex h-10 w-10 items-center justify-center rounded-2xl transition-colors" style={{ color: APPLE_SHELL.textMuted }}>
                  <Maximize2 className="h-4 w-4" />
                </button>
                <button onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (F1)" className="flex h-10 w-10 items-center justify-center rounded-2xl transition-colors" style={{ color: APPLE_SHELL.textMuted }}>
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}

          {explorerOpen && !zenMode && (
            <>
              <div className="m-3 ml-3 mr-0 flex shrink-0 flex-col overflow-hidden rounded-[28px]" style={{ width: sidebarWidth, background: "rgba(255,255,255,0.74)", border: `1px solid ${APPLE_SHELL.border}`, boxShadow: APPLE_SHELL.shadow, backdropFilter: "blur(18px)" }}>
                <div className="flex items-center justify-between border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-widest" style={{ color: APPLE_SHELL.textMuted, borderBottomColor: APPLE_SHELL.border }}>
                  <span>Explorer</span>
                  <select value={sortMode} onChange={(e) => { const next = e.target.value as SortMode; setSortMode(next); if (typeof window !== "undefined") window.localStorage.setItem(SORT_KEY, next); }} className="rounded-full px-2 py-1 text-[10px] outline-none" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.textMuted, border: `1px solid ${APPLE_SHELL.border}` }}>
                    <option value="recent">Recent</option>
                    <option value="name">Name</option>
                    <option value="size">Size</option>
                  </select>
                </div>

                <div className="px-3 py-2">
                  <div className="flex items-center gap-1 rounded-full px-3 py-1.5" style={{ background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}>
                    <Search className="h-3 w-3 shrink-0" style={{ color: APPLE_SHELL.textMuted }} />
                    <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Filter projects..." className="w-full bg-transparent text-xs outline-none" style={{ color: APPLE_SHELL.text }} />
                    {searchQuery && <button onClick={() => setSearchQuery("")} style={{ color: APPLE_SHELL.textMuted }}><X className="h-3 w-3" /></button>}
                  </div>
                </div>

                <div style={{ borderBottom: `1px solid ${APPLE_SHELL.border}` }}>
                  <button className="flex w-full items-center gap-1 px-3 py-2 text-[11px] uppercase" style={{ color: APPLE_SHELL.textMuted, letterSpacing: "0.1em" }}>
                    <ChevronDown className="h-3 w-3" /> Open Editors
                  </button>
                  {activeProjectQuery.data && (
                    <div className="mx-3 mb-2 flex items-center gap-2 rounded-[16px] px-3 py-2 text-xs" style={{ color: APPLE_SHELL.text, background: APPLE_SHELL.accentSoft, border: `1px solid ${APPLE_SHELL.border}` }}>
                      <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: APPLE_SHELL.accent }} />
                      <span className="truncate">{activeProjectQuery.data.title}.tex</span>
                    </div>
                  )}
                </div>

                {recentProjects.length > 0 && (
                  <div style={{ borderBottom: "1px solid #3e3e3e" }}>
                    <button className="flex w-full items-center gap-1 px-3 py-1 text-[11px] uppercase hover:bg-[#37373d]" style={{ color: "#bbbbbb", letterSpacing: "0.1em" }}>
                      <ChevronDown className="h-3 w-3" /> Recent
                    </button>
                    <div className="pb-1">
                      {recentProjects.slice(0, 4).map((project) => (
                        <button key={`recent-${project.id}`} onClick={() => setSelectedProjectId(project.id)} className="flex w-full items-center gap-2 px-6 py-1 text-left text-xs hover:bg-[#37373d]" style={{ color: project.id === activeProjectId ? "#cccccc" : "#858585" }}>
                          <RotateCcw className="h-3 w-3 shrink-0" />
                          <span className="truncate">{project.title}.tex</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-1 flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1">
                    <button className="flex items-center gap-1 text-[11px] uppercase" style={{ color: "#bbbbbb", letterSpacing: "0.1em" }}>
                      <ChevronDown className="h-3 w-3" /> Projects
                      {projects.length > 0 && <span className="ml-1 rounded-full px-1.5 text-[10px]" style={{ background: "#3c3c3c", color: "#858585" }}>{projects.length}</span>}
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => setShowTemplates(true)} title="New from template" className="rounded p-0.5 hover:bg-[#37373d]" style={{ color: "#858585" }}><Layers className="h-3.5 w-3.5" /></button>
                      <button onClick={importTexFile} title="Import .tex" className="rounded p-0.5 hover:bg-[#37373d]" style={{ color: "#858585" }}><Upload className="h-3.5 w-3.5" /></button>
                      <button onClick={() => void createProjectMutation.mutateAsync({})} disabled={createProjectMutation.isPending} title="New project" className="rounded p-0.5 hover:bg-[#37373d] disabled:opacity-40" style={{ color: "#858585" }}><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {projectsQuery.isLoading && (
                      <div className="flex flex-col gap-1 px-3 py-2">
                        {[1, 2, 3].map((index) => <div key={index} className="h-5 animate-pulse rounded" style={{ background: "#3c3c3c" }} />)}
                      </div>
                    )}
                    {filteredProjects.map((project) => (
                      <div key={project.id} className="group relative flex items-center text-xs transition-colors hover:bg-[#37373d]" style={{ background: project.id === activeProjectId ? "#37373d" : "transparent" }} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, projectId: project.id, title: project.title }); }}>
                        {renamingId === project.id ? (
                          <input autoFocus value={renamingValue} onChange={(e) => setRenamingValue(e.target.value)} onKeyDown={(e) => handleRenameKey(e, project.id)} onBlur={() => void commitRename(project.id)} className="mx-6 my-0.5 w-full rounded px-1 py-0.5 text-xs outline-none" style={{ background: "#3c3c3c", color: "#cccccc", border: "1px solid #007acc" }} />
                        ) : (
                          <button onClick={() => { setSelectedProjectId(project.id); touchRecentProject(project.id); }} onDoubleClick={() => startRename(project)} title={`${project.title} — double-click to rename, right-click for more`} className="flex flex-1 items-center gap-2 py-1 text-left" style={{ paddingLeft: favorites.has(project.id) || pinnedProjects.has(project.id) ? 20 : 24, color: project.id === activeProjectId ? "#cccccc" : "#858585" }}>
                            {pinnedProjects.has(project.id) && <Pin className="h-2.5 w-2.5 shrink-0" style={{ color: "#4ec9b0", fill: "#4ec9b0" }} />}
                            {favorites.has(project.id) && <Star className="h-2.5 w-2.5 shrink-0" style={{ color: "#ce9178", fill: "#ce9178" }} />}
                            <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: project.id === activeProjectId ? "#6796e6" : "#555555" }} />
                            <span className="truncate">{project.title}.tex</span>
                          </button>
                        )}
                        {renamingId !== project.id && (
                          <div className="absolute right-1 hidden items-center gap-0.5 group-hover:flex">
                            <button onClick={() => togglePinned(project.id)} title={pinnedProjects.has(project.id) ? "Unpin" : "Pin"} className="rounded p-0.5 hover:bg-[#4e4e4e]" style={{ color: pinnedProjects.has(project.id) ? "#4ec9b0" : "#858585" }}>
                              <Pin className="h-2.5 w-2.5" style={{ fill: pinnedProjects.has(project.id) ? "#4ec9b0" : "none" }} />
                            </button>
                            <button onClick={() => toggleFavorite(project.id)} title={favorites.has(project.id) ? "Remove favorite" : "Add favorite"} className="rounded p-0.5 hover:bg-[#4e4e4e]" style={{ color: favorites.has(project.id) ? "#ce9178" : "#858585" }}>
                              <Star className="h-2.5 w-2.5" style={{ fill: favorites.has(project.id) ? "#ce9178" : "none" }} />
                            </button>
                            <button onClick={() => startRename(project)} title="Rename" className="rounded p-0.5 hover:bg-[#4e4e4e]" style={{ color: "#858585" }}><Pencil className="h-2.5 w-2.5" /></button>
                            {deletingId === project.id ? (
                              <button onClick={() => void deleteMutation.mutateAsync(project.id)} className="rounded px-1 py-0.5 text-[10px] font-medium" style={{ background: "#f48771", color: "#1e1e1e" }}>✓</button>
                            ) : (
                              <button onClick={() => setDeletingId(project.id)} title="Delete" className="rounded p-0.5 hover:bg-[#4e4e4e]" style={{ color: "#858585" }}><Trash2 className="h-2.5 w-2.5" /></button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {!projectsQuery.isLoading && filteredProjects.length === 0 && searchQuery && <div className="px-6 py-2 text-xs" style={{ color: "#858585" }}>No results for “{searchQuery}”</div>}
                    {!projectsQuery.isLoading && filteredProjects.length === 0 && !searchQuery && (
                      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs" style={{ color: "#555555" }}>
                        <FileCode2 className="h-8 w-8 opacity-30" />
                        <span>No projects yet</span>
                        <button onClick={() => void createProjectMutation.mutateAsync({})} className="rounded px-3 py-1.5 text-xs" style={{ background: "#007acc", color: "#fff" }}>+ New Project</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="w-1 shrink-0 cursor-col-resize transition-colors hover:bg-[#007acc]" style={{ background: isDraggingSidebar ? "#007acc" : "transparent" }} onMouseDown={() => setIsDraggingSidebar(true)} />
            </>
          )}

          {activeProjectQuery.data ? (
            <LatexProjectCanvas key={activeProjectQuery.data.id} addToast={addToast} onExportTex={exportTex} onOpenCommandPalette={() => setShowCommandPalette(true)} onToggleZen={() => setZenMode((prev) => !prev)} project={activeProjectQuery.data} zenMode={zenMode} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-sm" style={{ background: "#1e1e1e", color: "#555555" }}>
              {projectsQuery.isLoading ? (
                <>
                  <LoaderCircle className="h-8 w-8 animate-spin opacity-40" />
                  <span>Loading projects...</span>
                </>
              ) : (
                <>
                  <FileCode2 className="h-12 w-12 opacity-20" />
                  <span>No project selected</span>
                  <button onClick={() => void createProjectMutation.mutateAsync({})} className="rounded px-4 py-2 text-sm" style={{ background: "#007acc", color: "#fff" }}>Create First Project</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function LatexProjectCanvas({
  addToast,
  onExportTex,
  onOpenCommandPalette,
  onToggleZen,
  project,
  zenMode,
}: {
  addToast: (type: Toast["type"], message: string) => void;
  onExportTex: (latex: string, title: string) => void;
  onOpenCommandPalette: () => void;
  onToggleZen: () => void;
  project: Awaited<ReturnType<typeof getLatexProject>>;
  zenMode: boolean;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(project.title);
  const [titleValue, setTitleValue] = useState(project.title);
  const [titleEditing, setTitleEditing] = useState(false);
  const [latex, setLatex] = useState(project.latex);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [promptHistoryIndex, setPromptHistoryIndex] = useState(-1);
  const [assistantHistory, setAssistantHistory] = useState<LatexAssistantTurn[]>(project.assistantHistory);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compileHash, setCompileHash] = useState<string | null>(project.lastCompiledHash);
  const [compileElapsed, setCompileElapsed] = useState<number | null>(null);
  const [compileHistory, setCompileHistory] = useState<CompileRecord[]>([]);
  const [showCompileHistory, setShowCompileHistory] = useState(false);
  const [texErrors, setTexErrors] = useState<TexError[]>([]);
  const [latestSummary, setLatestSummary] = useState(project.lastAssistantSummary);
  const [panelHeight, setPanelHeight] = useState<number>(() => {
    if (typeof window === "undefined") return 260;
    const value = window.localStorage.getItem(PANEL_HEIGHT_KEY);
    return value ? Math.max(120, parseInt(value, 10)) : 260;
  });
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [pdfZoomIndex, setPdfZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [wordWrap, setWordWrap] = useState<"on" | "off">("on");
  const [minimapEnabled, setMinimapEnabled] = useState(true);
  const [fontSize, setFontSize] = useState<number>(() => (typeof window === "undefined" ? 14 : parseInt(window.localStorage.getItem(FONT_SIZE_KEY) ?? "14", 10)));
  const [theme, setTheme] = useState<Theme>(() => (typeof window === "undefined" ? "vs" : ((window.localStorage.getItem(THEME_KEY) as Theme) ?? "vs")));
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [selectionInfo, setSelectionInfo] = useState<{ chars: number; lines: number } | null>(null);
  const [isUnsaved, setIsUnsaved] = useState(false);
  const [autoCompile, setAutoCompile] = useState(false);
  const [wordGoal, setWordGoal] = useState<number>(() => (typeof window === "undefined" ? 500 : parseInt(window.localStorage.getItem(WORD_GOAL_KEY) ?? "500", 10)));
  const [showWordGoal] = useState(false);
  const [compileLogs, setCompileLogs] = useState<string[]>([]);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [smartDockOpen, setSmartDockOpen] = useState(false);
  const [rightDockTab, setRightDockTab] = useState<RightDockTab>("dock");
  const [smartChecklist, setSmartChecklist] = useState<SmartChecklistItem[]>([
    { id: "title", label: "Document title feels specific", done: true },
    { id: "abstract", label: "Abstract or intro exists", done: false },
    { id: "sections", label: "At least 3 structural sections", done: false },
    { id: "equations", label: "Equations compile cleanly", done: false },
    { id: "citations", label: "References or citations placed", done: false },
    { id: "export", label: "Ready to export PDF", done: false },
  ]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco["editor"]["IStandaloneCodeEditor"] | null>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  const promptHistoryRef = useRef<string[]>([]);
  const saveSnapshotRef = useRef(snapshotProject(project.title, project.latex));
  const compileStartRef = useRef<number | null>(null);
  const compileNowRef = useRef<() => void>(() => {});
  const draftHydratedRef = useRef(false);

  const outlineItems = useMemo(() => parseOutline(latex), [latex]);
  const currentSection = useMemo(() => {
    if (outlineItems.length === 0) return "";
    let active = outlineItems[0];
    for (const item of outlineItems) {
      if (item.line <= cursorLine) active = item;
      else break;
    }
    return active?.label ?? "";
  }, [cursorLine, outlineItems]);
  const pdfZoom = ZOOM_STEPS[pdfZoomIndex] ?? 1;
  const searchMatchCount = useMemo(() => countMatches(latex, searchTerm), [latex, searchTerm]);

  const updateProjectMutation = useMutation({
    mutationFn: updateLatexProject,
    onSuccess: (updatedProject) => {
      queryClient.setQueryData(["latex-project", updatedProject.id], updatedProject);
      queryClient.invalidateQueries({ queryKey: ["latex-projects"] });
      saveSnapshotRef.current = snapshotProject(updatedProject.title, updatedProject.latex);
      setIsUnsaved(false);
      addToast("success", "Saved");
    },
    onError: () => addToast("error", "Save failed"),
  });

  const compileMutation = useMutation({
    mutationFn: compileLatexDocument,
    onSuccess: (result) => {
      const elapsed = compileStartRef.current ? Date.now() - compileStartRef.current : 0;
      const nextUrl = URL.createObjectURL(result.blob);
      setPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextUrl;
      });
      setCompileHash(result.hash);
      setCompileElapsed(elapsed);
      setTexErrors([]);
      setCompileLogs((prev) => [`✓ Compiled in ${formatDuration(elapsed)}${result.cacheHit ? " (cached)" : ""}`, ...prev.slice(0, 19)]);
      setCompileHistory((prev) => [{ hash: result.hash ?? "unknown", elapsed, ts: Date.now(), cacheHit: result.cacheHit }, ...prev.slice(0, 9)]);
      addToast("success", `Compiled in ${formatDuration(elapsed)}${result.cacheHit ? " ⚡" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["latex-projects"] });
      queryClient.invalidateQueries({ queryKey: ["latex-project", project.id] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Compilation failed";
      setTexErrors(parseTexErrors(message));
      setCompileLogs((prev) => [`✗ ${message.slice(0, 200)}`, ...prev.slice(0, 19)]);
      addToast("error", "Compilation failed — see error panel");
    },
  });

  const assistMutation = useMutation({
    mutationFn: assistLatexProject,
    onSuccess: (result) => {
      setTitle(result.project.title);
      setTitleValue(result.project.title);
      setLatex(result.project.latex);
      setAssistantHistory(result.project.assistantHistory);
      setLatestSummary(result.assistant.summary);
      setAssistantPrompt("");
      setIsUnsaved(false);
      saveSnapshotRef.current = snapshotProject(result.project.title, result.project.latex);
      queryClient.setQueryData(["latex-project", result.project.id], result.project);
      queryClient.invalidateQueries({ queryKey: ["latex-projects"] });
      addToast("success", result.assistant.summary.slice(0, 90));
    },
    onError: () => addToast("error", "AI assistant request failed"),
  });

  compileNowRef.current = () => {
    if (!latex.trim() || compileMutation.isPending) return;
    const blockers = findCompileBlockers(latex);
    if (blockers.length > 0) {
      setTexErrors(blockers.map((blocker) => ({ line: blocker.line, message: blocker.message, type: "error" as const })));
      setCompileLogs((prev) => [`✗ Compile blocked: unresolved snippet placeholders detected`, ...prev.slice(0, 19)]);
      addToast("warning", "Compile blocked until placeholder snippets are resolved");
      return;
    }
    compileStartRef.current = Date.now();
    void compileMutation.mutateAsync({ latex, projectId: project.id });
  };

  useEffect(() => {
    if (!pdfUrl) return undefined;
    return () => {
      URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    const snapshot = snapshotProject(title, latex);
    if (!title.trim() || !latex.trim() || snapshot === saveSnapshotRef.current) return;
    setIsUnsaved(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(draftStorageKey(project.id), JSON.stringify({ title, latex, ts: Date.now() }));
      window.requestAnimationFrame(() => setDraftAvailable(true));
    }
    const timeout = window.setTimeout(() => {
      void updateProjectMutation.mutateAsync({ projectId: project.id, title, latex });
      if (autoCompile) {
        compileStartRef.current = Date.now();
        void compileMutation.mutateAsync({ latex, projectId: project.id });
      }
    }, 900);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCompile, latex, project.id, title]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [assistantHistory, latestSummary]);

  useEffect(() => {
    if (typeof window === "undefined" || draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    const raw = window.localStorage.getItem(draftStorageKey(project.id));
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { title?: string; latex?: string };
      if (draft.latex && draft.latex !== project.latex) {
        window.requestAnimationFrame(() => setDraftAvailable(true));
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey(project.id));
    }
  }, [project.id, project.latex]);

  useEffect(() => {
    function onMove(event: MouseEvent) {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const nextHeight = Math.max(120, Math.min(640, rect.bottom - event.clientY - 24));
      setPanelHeight(nextHeight);
      if (typeof window !== "undefined") window.localStorage.setItem(PANEL_HEIGHT_KEY, String(nextHeight));
    }
    function onUp() {
      setIsDraggingPanel(false);
    }
    if (isDraggingPanel) {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDraggingPanel]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        compileNowRef.current();
      }
      if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void updateProjectMutation.mutateAsync({ projectId: project.id, title, latex });
      }
      if (event.ctrlKey && event.key === "`") {
        event.preventDefault();
        aiInputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === aiInputRef.current) {
        aiInputRef.current?.blur();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        onOpenCommandPalette();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latex, onOpenCommandPalette, project.id, title]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(WORD_GOAL_KEY, String(wordGoal));
  }, [wordGoal]);

  function jumpToLine(line: number) {
    if (!editorRef.current || line <= 0) return;
    editorRef.current.revealLineInCenter(line);
    editorRef.current.setPosition({ lineNumber: line, column: 1 });
    editorRef.current.focus();
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void handleAssist();
      return;
    }
    if (event.key === "ArrowUp") {
      const next = promptHistoryIndex + 1;
      if (next < promptHistoryRef.current.length) {
        event.preventDefault();
        setPromptHistoryIndex(next);
        setAssistantPrompt(promptHistoryRef.current[next]);
      }
    }
    if (event.key === "ArrowDown" && promptHistoryIndex >= 0) {
      event.preventDefault();
      const next = promptHistoryIndex - 1;
      if (next < 0) {
        setPromptHistoryIndex(-1);
        setAssistantPrompt("");
      } else {
        setPromptHistoryIndex(next);
        setAssistantPrompt(promptHistoryRef.current[next]);
      }
    }
  }

  async function handleAssist() {
    const prompt = assistantPrompt.trim();
    if (!prompt || assistMutation.isPending) return;
    promptHistoryRef.current = [prompt, ...promptHistoryRef.current.slice(0, 49)];
    setPromptHistoryIndex(-1);
    await assistMutation.mutateAsync({ projectId: project.id, prompt, latex });
  }

  function handleClearHistory() {
    setAssistantHistory([]);
    setLatestSummary("");
    promptHistoryRef.current = [];
    addToast("info", "Conversation cleared");
  }

  function handleCopyMessage(content: string) {
    navigator.clipboard.writeText(content).then(() => addToast("success", "Copied to clipboard")).catch(() => {});
  }

  function handleDownloadPdf() {
    if (!pdfUrl) return;
    const anchor = document.createElement("a");
    anchor.href = pdfUrl;
    anchor.download = `${title}.pdf`;
    anchor.click();
    addToast("success", `Downloaded ${title}.pdf`);
  }

  function restoreDraft() {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(draftStorageKey(project.id));
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as { title?: string; latex?: string };
      if (draft.title) {
        setTitle(draft.title);
        setTitleValue(draft.title);
      }
      if (draft.latex) setLatex(draft.latex);
      setIsUnsaved(true);
      addToast("info", "Recovered local draft");
    } catch {
      addToast("error", "Draft recovery failed");
    }
  }

  function discardDraft() {
    if (typeof window !== "undefined") window.localStorage.removeItem(draftStorageKey(project.id));
    setDraftAvailable(false);
    addToast("info", "Local draft discarded");
  }

  function replaceAllMatches() {
    if (!searchTerm) return;
    setLatex((prev) => prev.split(searchTerm).join(replaceTerm));
    addToast("success", `Replaced ${searchMatchCount} match${searchMatchCount === 1 ? "" : "es"}`);
  }

  function insertSnippet(snippet: (typeof LATEX_SNIPPETS)[number]) {
    const editor = editorRef.current;
    if (!editor) {
      const plainText = snippet.insertText.replace(/\$\{\d+:([^}]+)\}/g, "$1").replace(/\$0/g, "");
      setLatex((prev) => `${prev}\n${plainText}`);
      return;
    }
    const selection = editor.getSelection();
    if (!selection) return;
    editor.trigger("keyboard", "editor.action.insertSnippet", { snippet: snippet.insertText });
    editor.focus();
    addToast("success", `Inserted ${snippet.label}`);
  }

  function handlePdfWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey) return;
    event.preventDefault();
    if (event.deltaY < 0) setPdfZoomIndex((prev) => Math.min(ZOOM_STEPS.length - 1, prev + 1));
    else setPdfZoomIndex((prev) => Math.max(0, prev - 1));
  }

  const beforeMonacoMount: BeforeMount = (monaco) => {
    monaco.languages.register({ id: "latex" });
    monaco.languages.setMonarchTokensProvider("latex", {
      tokenizer: {
        root: [
          [/%.*/, "comment"],
          [/\\[a-zA-Z@]+\*?/, "keyword"],
          [/\$\$[\s\S]*?\$\$/, "string"],
          [/\$[^$\n]*\$/, "string"],
          [/[{}\[\]]/, "delimiter"],
          [/[0-9]+/, "number"],
        ],
      },
    });
    monaco.languages.setLanguageConfiguration("latex", {
      comments: { lineComment: "%" },
      brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
      autoClosingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "(", close: ")" },
        { open: "$", close: "$" },
      ],
      surroundingPairs: [
        { open: "{", close: "}" },
        { open: "[", close: "]" },
        { open: "$", close: "$" },
      ],
    });
    monaco.languages.registerCompletionItemProvider("latex", {
      triggerCharacters: ["\\"],
      provideCompletionItems: (model: Monaco["editor"]["ITextModel"], position: Monaco["Position"]) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: LATEX_SNIPPETS.map((snippet) => ({
            label: snippet.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: snippet.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: snippet.doc,
            range,
          })),
        };
      },
    });
  };

  const onEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((event) => {
      setCursorLine(event.position.lineNumber);
      setCursorCol(event.position.column);
    });
    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (!selection || selection.isEmpty()) {
        setSelectionInfo(null);
        return;
      }
      const text = editor.getModel()?.getValueInRange(selection) ?? "";
      setSelectionInfo({ chars: text.length, lines: selection.endLineNumber - selection.startLineNumber + 1 });
    });
    editor.addAction({
      id: "prism-compile",
      label: "Compile LaTeX",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyB],
      run: () => compileNowRef.current(),
    });
    editor.addAction({
      id: "prism-focus-ai",
      label: "Focus AI Input",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backquote],
      run: () => aiInputRef.current?.focus(),
    });
    editor.addAction({
      id: "prism-command-palette",
      label: "Open Command Palette",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
      run: () => onOpenCommandPalette(),
    });
  };

  const panelError = assistMutation.error ?? compileMutation.error;
  const words = wordCount(latex);
  const fileSize = formatBytes(new TextEncoder().encode(latex).length);
  const effectivePanelHeight = panelCollapsed ? 32 : panelHeight;
  const errorCount = texErrors.filter((item) => item.type === "error").length;
  const warningCount = texErrors.filter((item) => item.type === "warning").length;
  const equationCount = (latex.match(/\\begin\{equation\*?\}|\\begin\{align\*?\}|\$\$/g) ?? []).length;
  const citationCount = (latex.match(/\\cite\{/g) ?? []).length;
  const commentCount = (latex.match(/^%/gm) ?? []).length;
  const sectionCount = outlineItems.filter((item) => item.level === 1).length;
  const smartStats = [
    { label: "Words", value: String(words), accent: "#4ec9b0", hint: wordGoal > 0 ? `${Math.min(100, Math.round((words / wordGoal) * 100))}% of goal` : "No goal set" },
    { label: "Sections", value: String(sectionCount), accent: "#569cd6", hint: currentSection || "No section focus" },
    { label: "Math", value: String(equationCount), accent: "#ce9178", hint: equationCount > 0 ? "Equation blocks detected" : "No equation blocks yet" },
    { label: "Citations", value: String(citationCount), accent: "#dcdcaa", hint: citationCount > 0 ? "Reference hooks exist" : "No citations yet" },
    { label: "Comments", value: String(commentCount), accent: "#c586c0", hint: commentCount > 0 ? "Annotation trail present" : "No inline comments" },
    { label: "Errors", value: String(errorCount), accent: errorCount > 0 ? "#f48771" : "#4ec9b0", hint: warningCount > 0 ? `${warningCount} warnings` : errorCount > 0 ? "Compile issues visible" : "Clean right now" },
  ];

  function toggleChecklistItem(itemId: string) {
    setSmartChecklist((prev) => prev.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)));
  }

  return (
    <div ref={canvasRef} className="flex flex-1 flex-col overflow-hidden" style={{ background: `linear-gradient(180deg, ${APPLE_SHELL.appBg}, #eef2f8 68%, #f9fafb)` }}>
      <div className="flex h-12 shrink-0 items-center border-b px-3" style={{ background: "rgba(255,255,255,0.72)", borderBottom: `1px solid ${APPLE_SHELL.border}`, backdropFilter: "blur(22px)" }}>
        <div className="flex h-9 max-w-[260px] items-center gap-2 rounded-[18px] px-4 text-xs" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.text, border: `1px solid ${APPLE_SHELL.border}`, boxShadow: APPLE_SHELL.shadow }}>
          <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: APPLE_SHELL.accent }} />
          {titleEditing ? (
            <input
              autoFocus
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={() => {
                setTitleEditing(false);
                const next = titleValue.trim();
                if (next && next !== title) setTitle(next);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setTitleEditing(false);
                  const next = titleValue.trim();
                  if (next && next !== title) setTitle(next);
                }
                if (e.key === "Escape") {
                  setTitleEditing(false);
                  setTitleValue(title);
                }
              }}
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: APPLE_SHELL.text, borderBottom: `1px solid ${APPLE_SHELL.accent}` }}
            />
          ) : (
            <span className="max-w-[140px] cursor-pointer truncate" onDoubleClick={() => setTitleEditing(true)} title="Double-click to rename">{title}.tex</span>
          )}
          {isUnsaved && <span className="ml-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: APPLE_SHELL.text }} title="Unsaved changes" />}
        </div>
        <div className="ml-2 flex h-9 items-center gap-2 rounded-[18px] px-4 text-xs" style={{ background: APPLE_SHELL.panelMuted, color: APPLE_SHELL.textMuted, border: `1px solid ${APPLE_SHELL.border}` }}>
          <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: APPLE_SHELL.textMuted }} />
          <span>preview.pdf</span>
          {compileMutation.isPending && <LoaderCircle className="h-3 w-3 animate-spin" style={{ color: APPLE_SHELL.accent }} />}
        </div>
        <div className="ml-auto flex items-center gap-1 px-2">
          <button onClick={() => setSmartDockOpen((prev) => !prev)} title="Toggle right dock" className="rounded-full px-2.5 py-1.5 text-[11px]" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.textMuted, border: `1px solid ${APPLE_SHELL.border}` }}>⊞</button>
          <button onClick={() => setShowSearchPanel((prev) => !prev)} title="Toggle search & replace" className="rounded-full px-2.5 py-1.5 text-[10px]" style={{ background: showSearchPanel ? APPLE_SHELL.accentSoft : APPLE_SHELL.panelStrong, color: APPLE_SHELL.text, border: `1px solid ${APPLE_SHELL.border}` }}><Search className="h-3 w-3" /></button>
          <button onClick={() => setCompareMode((prev) => !prev)} title="Toggle compare mode" className="rounded-full px-3 py-1.5 text-[10px]" style={{ background: compareMode ? APPLE_SHELL.blackButton : APPLE_SHELL.panelStrong, color: compareMode ? "#ffffff" : APPLE_SHELL.text, border: `1px solid ${compareMode ? APPLE_SHELL.blackButton : APPLE_SHELL.border}` }}>Diff</button>
          <button onClick={() => setMinimapEnabled((prev) => !prev)} title={minimapEnabled ? "Hide minimap" : "Show minimap"} className="rounded-full px-2.5 py-1.5 text-[10px]" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.textMuted, border: `1px solid ${APPLE_SHELL.border}` }}><Layers className="h-3 w-3" /></button>
          {updateProjectMutation.isPending && <span className="flex items-center gap-1 text-xs" style={{ color: APPLE_SHELL.textMuted }}><LoaderCircle className="h-3 w-3 animate-spin" /></span>}
          <button onClick={() => setAutoCompile((prev) => !prev)} title={autoCompile ? "Auto-compile is on" : "Auto-compile is off"} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px]" style={{ background: autoCompile ? APPLE_SHELL.accentSoft : APPLE_SHELL.panelStrong, color: APPLE_SHELL.text, border: `1px solid ${APPLE_SHELL.border}` }}><RefreshCw className="h-3 w-3" /> {autoCompile ? "Auto" : "Manual"}</button>
          <button onClick={() => onExportTex(latex, title)} title="Export .tex" className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.text, border: `1px solid ${APPLE_SHELL.border}` }}><Download className="h-3 w-3" /><span className="text-[11px]">.tex</span></button>
          <div className="relative flex items-center">
            <button onClick={compileNowRef.current} disabled={compileMutation.isPending || !latex.trim()} title="Compile LaTeX (Ctrl+Shift+B)" className="flex items-center gap-1.5 rounded-l-full px-4 py-1.5 text-xs disabled:opacity-40" style={{ background: "linear-gradient(135deg, #111111, #2f2f32)", color: "#ffffff", borderRight: `1px solid rgba(255,255,255,0.12)` }}>
              {compileMutation.isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" style={{ color: "#ffffff" }} />}
              Compile
              <kbd className="rounded-full px-2 py-0.5 text-[10px] opacity-80" style={{ background: "rgba(255,255,255,0.12)" }}>⇧B</kbd>
            </button>
            <button onClick={() => setShowCompileHistory((prev) => !prev)} className="rounded-r-full px-2 py-1.5 text-xs" style={{ background: "linear-gradient(135deg, #111111, #2f2f32)", color: "#ffffff" }}><ChevronDown className="h-3 w-3" /></button>
            {showCompileHistory && <CompileHistoryDropdown records={compileHistory} onClose={() => setShowCompileHistory(false)} />}
          </div>
          <button onClick={onToggleZen} title="Zen mode (F11)" className="rounded-full p-2" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.textMuted, border: `1px solid ${APPLE_SHELL.border}` }}>{zenMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>
        </div>
      </div>

      {currentSection && !zenMode && (
        <div className="flex h-8 shrink-0 items-center gap-1 border-b px-4 text-[11px]" style={{ borderBottomColor: APPLE_SHELL.border, background: "rgba(255,255,255,0.68)", color: APPLE_SHELL.textMuted }}>
          <FileText className="h-3 w-3 shrink-0" style={{ color: APPLE_SHELL.accent }} />
          <span>{title}.tex</span>
          <ChevronRight className="h-3 w-3" />
          <span style={{ color: APPLE_SHELL.text }}>{currentSection}</span>
        </div>
      )}

      {draftAvailable && (
        <div className="flex h-10 shrink-0 items-center justify-between border-b px-4 text-xs" style={{ background: "linear-gradient(135deg, rgba(255,245,214,0.82), rgba(255,255,255,0.92))", borderBottomColor: APPLE_SHELL.border, color: "#7c5f10" }}>
          <span>Local draft available for this project.</span>
          <div className="flex items-center gap-2">
            <button onClick={restoreDraft} className="rounded px-2 py-1 hover:bg-[#3a3a2d]">Restore</button>
            <button onClick={discardDraft} className="rounded px-2 py-1 hover:bg-[#3a3a2d]">Discard</button>
          </div>
        </div>
      )}

      {showSearchPanel && (
        <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3 text-xs" style={{ background: "rgba(255,255,255,0.85)", borderBottomColor: APPLE_SHELL.border }}>
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: APPLE_SHELL.textMuted }} />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Find..." className="rounded-full px-3 py-2 outline-none" style={{ width: 200, background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.text, border: `1px solid ${APPLE_SHELL.border}` }} />
          <input value={replaceTerm} onChange={(e) => setReplaceTerm(e.target.value)} placeholder="Replace with..." className="rounded-full px-3 py-2 outline-none" style={{ width: 200, background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.text, border: `1px solid ${APPLE_SHELL.border}` }} />
          <button onClick={replaceAllMatches} disabled={!searchTerm} className="rounded-full px-3 py-2 disabled:opacity-40" style={{ background: APPLE_SHELL.blackButton, color: "#ffffff" }}>Replace All</button>
          <span style={{ color: APPLE_SHELL.textMuted }}>{searchMatchCount} match{searchMatchCount === 1 ? "" : "es"}</span>
        </div>
      )}

      {!zenMode && (
        <div className="px-4 pb-3">
          <AICopilotPanel
            assistantHistory={assistantHistory}
            assistantPrompt={assistantPrompt}
            assistPending={assistMutation.isPending}
            latestSummary={latestSummary}
            panelError={panelError instanceof Error ? panelError : null}
            showWordGoal={showWordGoal}
            words={words}
            wordGoal={wordGoal}
            onWordGoalChange={setWordGoal}
            onSetAssistantPrompt={setAssistantPrompt}
            onTextareaKeyDown={handleTextareaKeyDown}
            onAssist={() => void handleAssist()}
            onClearHistory={handleClearHistory}
            onCopyMessage={handleCopyMessage}
            aiInputRef={aiInputRef}
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden gap-3 px-4 pb-3" style={{ minHeight: 0 }}>
        {!zenMode && (
          <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-[28px]" style={{ background: "rgba(255,255,255,0.68)", border: `1px solid ${APPLE_SHELL.border}`, boxShadow: "0 10px 24px rgba(15,23,42,0.05)" }}>
            <div className="border-t px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: APPLE_SHELL.textMuted, borderTop: `1px solid ${APPLE_SHELL.border}` }}>
              Snippets
            </div>
            <div className="overflow-y-auto px-2 pb-3">
              {LATEX_SNIPPETS.map((snippet) => (
                <button key={snippet.label} onClick={() => insertSnippet(snippet)} className="mb-2 flex w-full flex-col items-start gap-0.5 rounded-[16px] px-3 py-2 text-left text-xs" style={{ background: "#ffffff", border: `1px solid ${APPLE_SHELL.border}` }}>
                  <span style={{ color: APPLE_SHELL.text }}>{snippet.label}</span>
                  <span style={{ color: APPLE_SHELL.textMuted }}>{snippet.doc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden gap-3" style={{ minWidth: 0 }}>
          <div className="flex flex-1 flex-col overflow-hidden rounded-[28px]" style={{ minWidth: 0, background: "#ffffff", border: `1px solid ${APPLE_SHELL.borderStrong}`, boxShadow: "0 14px 36px rgba(15,23,42,0.08)" }}>
          <Editor
            beforeMount={beforeMonacoMount}
            onMount={onEditorMount}
            height="100%"
            language="latex"
            theme={theme}
            value={latex}
            onChange={(value) => setLatex(value ?? "")}
            options={{
              minimap: { enabled: minimapEnabled },
              fontSize,
              lineHeight: Math.round(fontSize * 1.6),
              padding: { top: 12 },
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              wordWrap,
              fontLigatures: true,
              tabSize: 2,
              renderLineHighlight: "all",
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
              suggestOnTriggerCharacters: true,
              quickSuggestions: { other: true, comments: false, strings: false },
              lineNumbers: "on",
              glyphMargin: texErrors.length > 0,
              folding: true,
              foldingHighlight: true,
              showFoldingControls: "always",
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              stickyScroll: { enabled: true },
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            }}
          />
          {texErrors.length > 0 && (
            <div className="shrink-0 overflow-y-auto" style={{ maxHeight: 140, background: "#fff8f7", borderTop: `1px solid ${APPLE_SHELL.danger}` }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ background: "#fff1ef" }}>
                <div className="flex items-center gap-2">
                  {errorCount > 0 && <span className="text-[11px] font-semibold" style={{ color: "#f48771" }}>✗ {errorCount} error{errorCount > 1 ? "s" : ""}</span>}
                  {warningCount > 0 && <span className="text-[11px] font-semibold" style={{ color: "#ce9178" }}>⚠ {warningCount} warning{warningCount > 1 ? "s" : ""}</span>}
                  <span className="text-[10px]" style={{ color: APPLE_SHELL.textMuted }}>Click to jump</span>
                </div>
                <button onClick={() => setTexErrors([])} style={{ color: "#858585" }}><X className="h-3 w-3" /></button>
              </div>
              {texErrors.map((error) => (
                <div key={`${error.line}-${error.message}`} className="flex cursor-pointer items-start gap-2 px-3 py-1 text-xs transition-colors hover:bg-[#2d2d2d]" style={{ color: error.type === "error" ? "#f48771" : "#ce9178" }} onClick={() => jumpToLine(error.line)}>
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {error.line > 0 && <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px]" style={{ background: "#ffffff", color: APPLE_SHELL.accent, border: `1px solid ${APPLE_SHELL.border}` }}>L{error.line}</span>}
                  <span className="truncate">{error.message}</span>
                </div>
              ))}
            </div>
          )}
          </div>

          {compareMode && (
            <>
              <div className="flex w-[45%] shrink-0 flex-col overflow-hidden rounded-[28px]" style={{ background: APPLE_SHELL.panelStrong, minWidth: 260, border: `1px solid ${APPLE_SHELL.border}`, boxShadow: APPLE_SHELL.shadow }}>
                <div className="flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs" style={{ borderBottomColor: APPLE_SHELL.border, background: APPLE_SHELL.panelMuted, color: APPLE_SHELL.textMuted }}>
                  <span>Saved Snapshot</span>
                  <button onClick={() => setCompareMode(false)} style={{ color: "#858585" }}><X className="h-3 w-3" /></button>
                </div>
                <Editor
                  height="100%"
                  language="latex"
                  theme={theme}
                  value={project.latex}
                  options={{ readOnly: true, minimap: { enabled: false }, fontSize, lineHeight: Math.round(fontSize * 1.6), scrollBeyondLastLine: false, wordWrap: "on" }}
                />
              </div>
            </>
          )}

          {!zenMode && (
            <div className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-[28px]" style={{ background: "rgba(250,250,252,0.9)", border: `1px solid ${APPLE_SHELL.border}`, boxShadow: "0 8px 20px rgba(15,23,42,0.04)" }}>
              <div className="flex items-center justify-between border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: APPLE_SHELL.textMuted, borderBottomColor: APPLE_SHELL.border }}>
                <div className="flex items-center gap-1">
                  <button onClick={() => setRightDockTab("outline")} className="rounded-full px-3 py-1 text-[10px]" style={{ background: rightDockTab === "outline" ? APPLE_SHELL.blackButton : APPLE_SHELL.panelStrong, color: rightDockTab === "outline" ? "#ffffff" : APPLE_SHELL.textMuted, border: `1px solid ${rightDockTab === "outline" ? APPLE_SHELL.blackButton : APPLE_SHELL.border}` }}>Outline</button>
                  <button onClick={() => setRightDockTab("dock")} className="rounded-full px-3 py-1 text-[10px]" style={{ background: rightDockTab === "dock" ? APPLE_SHELL.blackButton : APPLE_SHELL.panelStrong, color: rightDockTab === "dock" ? "#ffffff" : APPLE_SHELL.textMuted, border: `1px solid ${rightDockTab === "dock" ? APPLE_SHELL.blackButton : APPLE_SHELL.border}` }}>Smart Dock</button>
                  <button onClick={() => setRightDockTab("preview")} className="rounded-full px-3 py-1 text-[10px]" style={{ background: rightDockTab === "preview" ? APPLE_SHELL.blackButton : APPLE_SHELL.panelStrong, color: rightDockTab === "preview" ? "#ffffff" : APPLE_SHELL.textMuted, border: `1px solid ${rightDockTab === "preview" ? APPLE_SHELL.blackButton : APPLE_SHELL.border}` }}>PDF</button>
                </div>
                <button onClick={() => setSmartDockOpen(false)} className="rounded-full px-3 py-1 text-[10px]" style={{ background: APPLE_SHELL.panelStrong, color: APPLE_SHELL.textMuted, border: `1px solid ${APPLE_SHELL.border}` }}>Hide</button>
              </div>
              {rightDockTab === "outline" ? (
                <OutlinePanel currentLine={cursorLine} items={outlineItems} onJump={jumpToLine} />
              ) : rightDockTab === "dock" ? (
                <SmartDock
                  checklist={smartChecklist}
                  currentSection={currentSection}
                  latestSummary={latestSummary}
                  onInsertSnippet={insertSnippet}
                  onJump={jumpToLine}
                  onToggleChecklist={toggleChecklistItem}
                  outlineItems={outlineItems}
                  quickStats={smartStats}
                />
              ) : (
                <div className="flex flex-1 overflow-auto" style={{ background: "linear-gradient(180deg, #eef2f7, #dde4ef)" }} onWheel={handlePdfWheel}>
                  {compileMutation.error instanceof Error ? (
                    <div className="flex flex-1 flex-col gap-2 p-4 text-xs" style={{ color: APPLE_SHELL.danger }}>
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-semibold">Compilation failed</span>
                      <span style={{ wordBreak: "break-word", color: APPLE_SHELL.text, whiteSpace: "pre-wrap" }}>{compileMutation.error.message.slice(0, 400)}</span>
                    </div>
                  ) : pdfUrl ? (
                    <div className="min-w-full">
                      <div className="flex items-center justify-between px-3 py-2 text-xs" style={{ color: APPLE_SHELL.textMuted }}>
                        <span>{compileHash ? (compileElapsed != null ? formatDuration(compileElapsed) : compileHash.slice(0, 7)) : "Preview"}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setPdfZoomIndex((prev) => Math.max(0, prev - 1))}><ZoomOut className="h-3 w-3" /></button>
                          <span>{Math.round(pdfZoom * 100)}%</span>
                          <button onClick={() => setPdfZoomIndex((prev) => Math.min(ZOOM_STEPS.length - 1, prev + 1))}><ZoomIn className="h-3 w-3" /></button>
                          <button onClick={handleDownloadPdf} className="rounded-full px-2 py-1" style={{ background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}>Download</button>
                        </div>
                      </div>
                      <div style={{ transform: `scale(${pdfZoom})`, transformOrigin: "top left", width: `${(100 / pdfZoom).toFixed(1)}%`, height: `${(100 / pdfZoom).toFixed(1)}%`, flexShrink: 0 }}>
                        <iframe title="Compiled PDF" src={pdfUrl} style={{ width: "100%", height: "100%", border: "none", background: "white" }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center text-xs" style={{ color: APPLE_SHELL.textMuted }}>Not compiled yet</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-2 shrink-0 cursor-row-resize transition-colors" style={{ background: isDraggingPanel ? "rgba(0,113,227,0.18)" : "transparent" }} onMouseDown={() => setIsDraggingPanel(true)} />

      <div className="flex shrink-0 flex-col overflow-hidden rounded-t-[28px]" style={{ height: effectivePanelHeight, borderTop: `1px solid ${APPLE_SHELL.border}`, background: "rgba(255,255,255,0.92)", boxShadow: "0 -12px 40px rgba(15,23,42,0.06)" }}>
        <div className="flex h-10 shrink-0 items-center" style={{ background: APPLE_SHELL.panelMuted, borderBottom: panelCollapsed ? "none" : `1px solid ${APPLE_SHELL.border}` }}>
          <div className="flex h-full items-center px-3 text-xs font-medium" style={{ color: APPLE_SHELL.textMuted }}>
            <Terminal className="mr-2 h-3.5 w-3.5" style={{ color: APPLE_SHELL.success }} />
            Compiler Log
            {compileLogs.length > 0 && <span className="ml-2 rounded-full px-1 text-[9px]" style={{ background: "#eceef3" }}>{compileLogs.length}</span>}
          </div>
          {assistMutation.isPending && <span className="ml-2 flex items-center gap-1 text-xs" style={{ color: APPLE_SHELL.textMuted }}><LoaderCircle className="h-3 w-3 animate-spin" /> thinking...</span>}
          <div className="ml-auto flex items-center gap-1 pr-2">
            {compileLogs.length > 0 && <button onClick={() => setCompileLogs([])} title="Clear log" className="rounded-full p-2" style={{ color: APPLE_SHELL.textMuted, background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}><Trash2 className="h-3 w-3" /></button>}
            <button onClick={() => setPanelCollapsed((prev) => !prev)} title={panelCollapsed ? "Expand" : "Minimize"} className="rounded-full p-2" style={{ color: APPLE_SHELL.textMuted, background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }}>{panelCollapsed ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}</button>
          </div>
        </div>

        {!panelCollapsed && (
          <div className="flex-1 overflow-y-auto p-3 font-mono text-[11px]" style={{ color: "#d4d4d4", lineHeight: "18px" }}>
            {compileLogs.length === 0 ? <div style={{ color: "#555555" }}>No compile logs yet. Press Ctrl+Shift+B to compile.</div> : compileLogs.map((log, index) => <div key={`${log}-${index}`} style={{ color: log.startsWith("✗") ? "#f48771" : log.startsWith("✓") ? "#4ec9b0" : "#d4d4d4", marginBottom: 2 }}>{log}</div>)}
          </div>
        )}
      </div>

      <div className="flex h-8 shrink-0 select-none items-center justify-between px-4 text-[11px]" style={{ background: "linear-gradient(90deg, #ffffff, #f5f7fb 48%, #eef4ff)", color: APPLE_SHELL.text, borderTop: `1px solid ${APPLE_SHELL.border}` }}>
        <div className="flex items-center gap-3">
          {isUnsaved ? <span style={{ opacity: 0.85 }}>saved pending</span> : <span className="flex items-center gap-1" style={{ opacity: 0.75 }}><Check className="h-3 w-3" /> saved</span>}
          {compileMutation.isPending ? <span className="flex items-center gap-1"><LoaderCircle className="h-3 w-3 animate-spin" /> compiling</span> : compileHash ? <span className="flex items-center gap-1" style={{ opacity: 0.8 }}><CircleCheckBig className="h-3 w-3" /> compiled</span> : null}
          <button onClick={() => { const line = window.prompt("Go to line:", String(cursorLine)); if (line) jumpToLine(parseInt(line, 10)); }} className="rounded-full px-2 py-1" style={{ background: APPLE_SHELL.panelStrong, border: `1px solid ${APPLE_SHELL.border}` }} title="Go to line">Ln {cursorLine}, Col {cursorCol}</button>
          {selectionInfo && <span style={{ opacity: 0.85 }}>({selectionInfo.chars} chars{selectionInfo.lines > 1 ? `, ${selectionInfo.lines} lines` : ""} selected)</span>}
          <span style={{ opacity: 0.75 }}>{words} words</span>
          <span style={{ opacity: 0.75 }}>{sectionCount} sections</span>
          {errorCount > 0 && <span style={{ color: APPLE_SHELL.danger }}>⚠ {errorCount} errors</span>}
          <span style={{ opacity: 0.75 }}>{fileSize}</span>
        </div>
        <div className="flex items-center gap-3">
          {autoCompile && <span style={{ opacity: 0.8 }}>⚡ auto</span>}
          <div className="flex items-center gap-0.5">
            <button onClick={() => setFontSize((prev) => Math.max(10, prev - 1))} title="Decrease font size" className="rounded px-1 py-0.5 text-[10px]" style={{ color: APPLE_SHELL.textMuted }}>A-</button>
            <span className="text-[10px]" style={{ color: APPLE_SHELL.textMuted }}>{fontSize}</span>
            <button onClick={() => setFontSize((prev) => Math.min(24, prev + 1))} title="Increase font size" className="rounded px-1 py-0.5 text-[10px]" style={{ color: APPLE_SHELL.textMuted }}>A+</button>
          </div>
          <button onClick={() => setWordWrap((prev) => prev === "on" ? "off" : "on")} className="rounded px-1 hover:bg-[#1f8ad2]">{wordWrap === "on" ? "Wrap" : "No Wrap"}</button>
          <button onClick={() => setMinimapEnabled((prev) => !prev)} className="rounded px-1 hover:bg-[#1f8ad2]">Map</button>
          <button onClick={() => { setSmartDockOpen(true); setRightDockTab("outline"); }} className="rounded px-1 hover:bg-[#1f8ad2]" style={{ opacity: smartDockOpen ? 1 : 0.7 }}>Outline</button>
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="rounded px-1 text-[10px] outline-none" style={{ background: "transparent", color: APPLE_SHELL.textMuted, border: "none" }}>
            <option value="vs">Light</option>
            <option value="vs-dark">Dark</option>
            <option value="hc-black">HC Black</option>
          </select>
          <span style={{ opacity: 0.6 }}>OpenRouter</span>
          <span style={{ opacity: 0.6 }}>UTF-8</span>
          <span style={{ opacity: 0.6 }}>LF</span>
          <span style={{ opacity: 0.75 }}>LaTeX</span>
        </div>
      </div>
    </div>
  );
}
