<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Savvy In Teal storefront — agent rules

- **Read `.claude/skills/storefront-editing/SKILL.md` before changing anything the shopper sees.** Content edits belong in `frontend/content/`, theme edits in `app/globals.css` tokens, never hardcoded in `components/`.
- **Read `.claude/skills/karpathy/SKILL.md` before writing code.** Small diffs, no new dependencies without justification, no speculative abstraction.
- Verify every change with `npm run build` and `npm run test` from `frontend/`.
- Animations live in `app/globals.css` (keyframes + `.reveal`) and `components/ui/Reveal.tsx`; they must respect `prefers-reduced-motion`.
- Images: Pexels CDN via the `px()` helper in `content/site.config.ts`, or files in `public/`. New hosts go in `next.config.ts` `remotePatterns`.
