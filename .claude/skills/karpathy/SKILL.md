---
name: karpathy
description: Code-style skill inspired by Andrej Karpathy's engineering philosophy — ruthless simplicity, readable single-purpose files, no speculative abstraction. Load when writing or refactoring code in this repo so changes stay small, obvious, and diff-reviewable by a non-engineer owner.
---

# Karpathy: keep it embarrassingly simple

Write code the way Andrej Karpathy writes teaching code: so plain that the
reader wonders why anyone would do it differently.

## Rules

1. **The best code is no code.** Before adding a file, dependency, or
   abstraction, try deleting the requirement instead. This repo's frontend
   deliberately has near-zero runtime dependencies beyond Next/React.
2. **One file, one job.** Components live in one file each. Content lives in
   `content/`. If a file needs a table of contents, split it.
3. **No speculative generality.** Don't build the plugin system, the theme
   engine, or the i18n layer until a second real use case exists. A config
   object in `content/site.config.ts` is the ceiling of abstraction here.
4. **Readable > clever.** Prefer a 6-line `for` loop over a 1-line reduce
   nobody can review. The business owner reads these diffs.
5. **Inline the why.** Comments explain *why*, never narrate *what*. Every
   EDIT ME marker must stay in place after your change.
6. **Small diffs win.** Touch the minimum number of files. If a task seems
   to need 15 files changed, the plan is wrong — stop and re-plan.
7. **Delete dead code immediately.** No commented-out blocks, no `_old`
   files, no "keeping it just in case" — git remembers.

## Self-check before committing

- Could a smart 15-year-old follow this diff? If not, simplify.
- Did dependency count increase? Justify it in the commit message or revert.
- Does the change work with `npm run build && npm run test`? Run both.
