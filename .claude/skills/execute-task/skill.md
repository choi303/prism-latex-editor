---
name: execute-task
description: Execute tasks following the mandatory 6-stage workflow. Use when executing tasks from tasks/ folder, implementing features, fixing bugs, or refactoring code.
---

# Execute Task Workflow

Execute tasks from the tasks/ folder following the 6-stage development workflow.

## Workflow Stages

```
STAGE 1: RESEARCH        Read the spec, explore relevant code, understand scope
STAGE 2: PLANNING        Create implementation plan with specific files and changes
STAGE 3: PLAN REVIEW     MANDATORY STOP - present plan, wait for approval
STAGE 4: IMPLEMENTATION  Execute approved plan, build frequently
STAGE 5: VERIFICATION    Test changes, run dev server, check in browser
STAGE 6: CODE REVIEW     Review against standards, check for issues
```

## Steps

1. Read the task specification file (task-NNNN.00-specification.txt)
2. Research the relevant code (read files, understand the current state)
3. Create a plan listing exact files to change and what changes to make
4. STOP and present the plan to the user. Wait for approval.
5. After approval, create a feature branch: dev-[user]-task[NNNN]
6. Implement changes following the plan
7. Run `pnpm dev` and verify the changes work
8. Review code against standards/coding-standards.txt
9. Commit and create a pull request
10. Rename the task folder suffix to .done

## Rules

- Never implement without plan approval
- Never skip verification
- Never merge implementation PRs (user reviews and merges)
- Always run the dev server and test before claiming done
- Read relevant code before proposing changes
