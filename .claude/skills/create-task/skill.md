---
name: create-task
description: Create new task specifications in the tasks/ folder. Use when the user wants to create a new task, track work, or plan future changes.
---

# Create Task

Create task specification files following the standard task format.

## Steps

1. Determine the next task number:
   - List all folders in tasks/
   - Find the highest task number
   - Add 1

2. Get today's date in YYMMDD format

3. Create the task folder:
   - Pattern: YYMMDD.task-NNNN.description.pending
   - description in kebab-case

4. Create the specification file (task-NNNN.00-specification.txt):
   ```
   task-NNNN
   short description
   YYMMDD
   target app (api, web, or both)
   category (feature, bugfix, refactoring, investigation, report)

   source: where the task came from
   quote: exact quote if applicable

   context
       background information

   objective
       what needs to be done

   acceptance criteria
       measurable conditions for done
   ```

5. Present the specification to the user for review before committing

## Rules

- Follow standards/task-format.txt exactly
- Never skip task numbers
- Always use plain text, no markdown
- Include source and context
- Acceptance criteria must be measurable and verifiable
