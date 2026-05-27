import Link from "next/link";

import { ArrowRight, Sparkles, Waves } from "lucide-react";

import { Reveal } from "@/components/site/reveal";

const featureCards = [
  {
    title: "AI-first LaTeX editing",
    description:
      "Use plain-language commands like fixing equations, inserting tables, or restructuring sections while the assistant rewrites the source for you.",
  },
  {
    title: "Compiler proxy with cache",
    description:
      "Compile through the backend, avoid CORS and key exposure, and reuse Redis-cached PDFs instantly when the source hash is unchanged.",
  },
  {
    title: "Projects with memory",
    description:
      "Store LaTeX projects and assistant history in MongoDB so the editor keeps context instead of resetting every time.",
  },
];

const workflowSteps = [
  "Edit LaTeX on the left with Monaco and compile through the backend.",
  "See the generated PDF on the right without exposing compiler credentials.",
  "Use the AI command panel to patch formulas, tables, or sections directly into the document.",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-5 pb-12 pt-6 sm:px-8 lg:px-10">
      <Reveal className="gradient-frame panel sticky top-4 z-20 flex items-center justify-between rounded-full px-5 py-3">
        <div className="flex items-center gap-3 text-sm text-[var(--foreground-soft)]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-white">
            P
          </span>
          Prism
        </div>
        <div className="hidden items-center gap-6 text-sm text-[var(--foreground-soft)] md:flex">
          <a href="#product">Product</a>
          <a href="#workflow">Workflow</a>
          <a href="#workspace">Workspace</a>
        </div>
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5"
        >
          Open preview
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Reveal>

      <section className="grid flex-1 items-center gap-10 px-1 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <Reveal className="space-y-7" delay={0.05}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-[var(--foreground-soft)]">
            <Sparkles className="h-4 w-4" />
            Premium AI workspace, rebuilt from first principles
          </span>
          <div className="space-y-5">
            <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-[-0.06em] text-[var(--foreground)] sm:text-6xl lg:text-7xl">
              A real-time AI LaTeX editor with compile, preview, and code-aware assistance.
            </h1>
            <p className="max-w-2xl text-balance text-lg leading-8 text-[var(--foreground-soft)] sm:text-xl">
              Prism now focuses on technical writing workflows: edit TeX, compile via a protected backend proxy, preview the PDF instantly, and let AI modify the source instead of only talking about it.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/workspace"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-6 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition-transform duration-200 hover:-translate-y-0.5"
            >
              Explore workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#product"
              className="inline-flex items-center justify-center rounded-full border border-[var(--line-strong)] bg-white/75 px-6 py-3.5 text-sm font-semibold text-[var(--foreground)]"
            >
              Review product architecture
            </a>
          </div>
          <div className="grid gap-4 pt-4 sm:grid-cols-3">
            {[
              ["OpenRouter-ready", "Segmented fast, balanced, premium model lanes"],
              ["Mongo + Redis", "Persistence, caching, file states, and recovery"],
              ["Mobile-friendly", "A dense workspace that still reads clearly on small screens"],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-[22px] border border-[var(--line)] bg-white/72 p-4 shadow-[var(--shadow-card)]">
                <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--foreground-soft)]">{copy}</p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal className="gradient-frame panel rounded-[32px] p-4 sm:p-6" delay={0.12}>
          <div className="rounded-[26px] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(245,248,255,0.95),_rgba(255,255,255,0.78)_62%)] p-4 shadow-[var(--shadow-card)] sm:p-5">
            <div className="flex items-center justify-between rounded-[20px] border border-[var(--line)] bg-white/82 px-4 py-3 text-sm text-[var(--foreground-soft)]">
              <span>Workspace preview</span>
              <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[var(--accent)]">Balanced lane</span>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3 rounded-[24px] border border-[var(--line)] bg-white/84 p-4">
                <div className="flex items-center justify-between text-sm text-[var(--foreground-soft)]">
                  <span>Contexts</span>
                  <Waves className="h-4 w-4" />
                </div>
                {workflowSteps.map((step, index) => (
                  <div key={step} className="rounded-[18px] border border-[var(--line)] bg-[var(--background)] px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-[var(--foreground-soft)]">0{index + 1}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{step}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-[24px] border border-[var(--line)] bg-[#0f172a] p-4 text-white sm:p-5">
                <div className="flex items-center justify-between text-sm text-white/64">
                  <span>Editor + assistant</span>
                  <span>Live PDF preview</span>
                </div>
                <div className="mt-6 space-y-4">
                  <div className="max-w-[85%] rounded-[20px] rounded-bl-md bg-white/10 px-4 py-3 text-sm leading-6 text-white/84">
                    Add a 3-column comparison table under the introduction section.
                  </div>
                  <div className="ml-auto max-w-[92%] rounded-[20px] rounded-br-md bg-white px-4 py-3 text-sm leading-6 text-[#0f172a]">
                    The assistant updates the LaTeX source directly, then the compiler proxy regenerates the PDF and serves it from cache when possible.
                  </div>
                </div>
                <div className="mt-8 rounded-[22px] border border-white/12 bg-white/8 px-4 py-3 text-sm text-white/68">
                  Monaco editor, Redis-backed compile cache, Mongo project persistence, and OpenRouter command parsing all live in the workspace.
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section id="product" className="grid gap-5 py-6 lg:grid-cols-3">
        {featureCards.map((card, index) => (
          <Reveal
            key={card.title}
            delay={0.08 + index * 0.05}
            className="gradient-frame panel rounded-[28px] p-6"
          >
            <p className="text-sm uppercase tracking-[0.26em] text-[var(--foreground-soft)]">0{index + 1}</p>
            <h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">{card.title}</h2>
            <p className="mt-4 text-base leading-7 text-[var(--foreground-soft)]">{card.description}</p>
          </Reveal>
        ))}
      </section>

      <Reveal
        id="workspace"
        className="gradient-frame panel mt-6 rounded-[34px] px-6 py-7 sm:px-8 sm:py-8"
        delay={0.2}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--foreground-soft)]">Implementation path</p>
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
              The workspace now behaves like an actual TeX toolchain instead of a static chat demo.
            </h2>
          </div>
          <Link
            href="/workspace"
            className="inline-flex items-center justify-center rounded-full border border-[var(--line-strong)] bg-white/80 px-5 py-3 text-sm font-semibold"
          >
            Open workspace preview
          </Link>
        </div>
      </Reveal>
    </main>
  );
}
