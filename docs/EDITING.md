# Editing this store with AI (no coding required)

This storefront was built so that **any LLM connected to the repo**
(Claude Code, Cursor, Copilot Workspace, etc.) can safely make changes —
and so that you, the owner, can describe changes in plain language.

## How it works

All the *content* of the store lives in three editable places:

1. `frontend/content/site.config.ts` — brand, navigation, homepage copy, footer
2. `frontend/content/catalog.ts` — every product and collection
3. `frontend/app/globals.css` — the color palette (top of the file)

The visual components read from those files. An AI editing your store should
almost never touch `components/` — and the repo's skills
(`.claude/skills/storefront-editing/`, `.claude/skills/karpathy/`) tell it so.

## Copy-paste prompts that work

**Change a price**
> In frontend/content/catalog.ts, change the Mulberry Silk Scrunchie Trio price to 899 and put it on sale.

**Add a product**
> Add a new product to catalog.ts: "Velvet Bow Barrette", ₹549 (MRP ₹749), material velvet + steel, in the hair-accessories collection. Reuse the barrette care instructions. Find a suitable free Pexels photo.

**Change the homepage**
> In site.config.ts, change the hero accent word to "Kept", the headline to "together, calmly." and point the CTA at the jewellery collection.

**Rebrand / clone the store**
> Clone this storefront for a handmade-candle brand called "Wick & Whim". Rewrite content/site.config.ts and content/catalog.ts for 8 candle products, change the palette in globals.css to warm amber tones, and tell me which logo files to replace in public/brand/.

**Seasonal campaign**
> Update the announcement messages and hero for a Diwali sale: 20% off everything, code DIYA20.

## Rules the AI follows (and you can hold it to)

- Content edits go in `content/`, never hardcoded into components.
- Every image needs alt text; stock photos come from Pexels (free license).
- After any change it must run `npm run build` and `npm run test` and both must pass.
- Small diffs: if a change touches more than a handful of files, ask it to re-plan.

## Running the store locally

```bash
cd frontend
npm install
npm run dev     # opens http://localhost:3000
```
