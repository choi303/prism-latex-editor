---
name: write-report
description: Write reports and analysis documents. Reports go in reports/ folder as plain text files. Use when writing analysis, investigation, audit, or research documents.
---

# Write Report

Write reports to files in the reports/ folder. Never output report content to the terminal.

## Steps

1. Determine the report file name:
   - Pattern: YYMMDD.report-name.txt
   - report-name in kebab-case

2. Write the report following standards/report-format.txt:
   - Plain text only (no markdown)
   - Headers with ==== or ---- separators
   - Numbered sections and subsections
   - Grounded language (name exact files, functions, endpoints)

3. Open the report for user review

## Format

```
REPORT TITLE
============

Date: YYYY-MM-DD
Author: [name]

================================================================================
1. PURPOSE
================================================================================

Why this report exists. One paragraph.

================================================================================
2. FINDINGS
================================================================================

2.1 First Finding
-----------------

Details with exact file paths, function names, line numbers.

2.2 Second Finding
------------------

More details.

================================================================================
3. SUMMARY
================================================================================

Key takeaways and actionable items.
```

## Rules

- Always write to file, never to terminal
- Use grounded language (no vague referents)
- Use "N of M" format for counts
- Name exact files, functions, endpoints
- Include file.ts:line-number references for code
- Plain text only, no markdown formatting
