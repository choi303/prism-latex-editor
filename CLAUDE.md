# CLAUDE.md

Guidance for Claude Code in this repository.

## Overview

Prism is an AI-powered LaTeX editing workspace. Monorepo with:
- apps/api: Fastify backend (LaTeX compilation proxy, project CRUD, AI assist via OpenRouter)
- apps/web: Next.js 16 frontend (Monaco editor, PDF preview, AI command panel)
- packages/config: Shared ESLint and TypeScript configuration
- packages/ui: Shared UI components

## Running

```bash
pnpm install
pnpm dev          # starts both api (port 4000) and web (port 3000)
```

Requirements:
- Node.js 20+
- pnpm 10.9+
- MongoDB (local or Docker: docker run -d -p 27017:27017 --name prism-mongo mongo:7)
- Optional: Upstash Redis (compile caching), OpenRouter API key (AI features)

Environment: copy apps/api/.env.example to apps/api/.env

## Standards

Standards are in `standards/` folder (plain text, not markdown):
- `coding-standards.txt` - naming, file organization, TypeScript, API conventions
- `task-format.txt` - task specification folder and file format
- `report-format.txt` - report file naming and content format
- `workflow.txt` - 6-stage development workflow
- `project-structure.txt` - monorepo layout and module patterns

## Skills

Claude Code skills in `.claude/skills/`:
- `execute-task` - Execute tasks from tasks/ following 6-stage workflow
- `create-task` - Create new task specifications
- `write-report` - Write analysis reports to files
- `create-pr` - Create pull requests with correct format

## Folders

| Folder | Purpose |
|--------|---------|
| standards/ | Coding standards and conventions (plain text) |
| tasks/ | Task specifications and tracking |
| reports/ | Analysis reports and investigations |
| skills/ | Skill documentation and reference |

## Development Workflow

All non-trivial tasks follow the 6-stage workflow (see standards/workflow.txt):
1. Research
2. Planning
3. Plan Review (MANDATORY STOP - wait for approval)
4. Implementation
5. Verification
6. Code Review

## Git Rules

- Never push directly to main. Always use pull requests.
- Never rebase. Use merge.
- Branch naming: dev-[username]-[description]
- Commit messages: imperative mood, no emojis, no AI mentions
- Never mention AI tools in commits, PR descriptions, or authorship

## Report Rules

- Always write reports to files (reports/YYMMDD.name.txt), never to terminal
- Use plain text formatting, not markdown
- Use grounded language: name exact files, functions, endpoints
- Use "N of M" format for counts

## Task Rules

- Task folders in tasks/ with format: YYMMDD.task-NNNN.description.pending
- Sequential numbering from 0001
- Rename to .done when complete
- Specifications use plain text format (see standards/task-format.txt)

## Coding Rules

### TypeScript
- Explicit types for function parameters and return values
- Zod for runtime validation
- No any without documented reason

### API
- All routes under /v1/ prefix
- Zod validation on request bodies
- { data: ... } for success, { error: ... } for failure
- Service layer for business logic, routes for HTTP concerns

### File Organization
- One component per file
- File name matches primary export
- Group by feature module

### Naming
- Files: kebab-case (latex-workspace.tsx)
- Variables/functions: camelCase (compileLatex)
- Types: PascalCase (CompileInput)
- Constants: UPPER_SNAKE_CASE (MAX_FILE_SIZE)
- React components: PascalCase (LatexWorkspace)
