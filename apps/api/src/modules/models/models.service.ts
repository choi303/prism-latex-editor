const modelSegments = [
  {
    id: "fast",
    label: "Fast",
    description: "Quick responses for drafting and iteration.",
    defaultModel: "deepseek/deepseek-v4-flash:free"
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Best default for everyday work across writing and analysis using a free model lane.",
    defaultModel: "deepseek/deepseek-v4-flash:free"
  },
  {
    id: "premium",
    label: "Deep",
    description: "Heavier prompting, still pinned to a free model until paid lanes are enabled.",
    defaultModel: "deepseek/deepseek-v4-flash:free"
  }
] as const;

export function listModelSegments() {
  return modelSegments;
}