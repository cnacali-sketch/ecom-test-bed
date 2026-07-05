---
name: storefront-editing
description: How to edit the Savvy In Teal storefront (frontend/). Load this for ANY request that changes what the store looks like or sells — copy, products, prices, images, colors, navigation, homepage sections, or rebranding/cloning the store to a new product genre. Routes edits to the content layer instead of components.
---

# Storefront editing: change content, not components

This storefront is deliberately split into a **content layer** (edit freely)
and a **component layer** (rarely touch). Nearly every business request is a
content-layer edit.

## The map

| The owner wants to change…       | Edit this file                          |
| -------------------------------- | --------------------------------------- |
| Brand name, logo, tagline        | `frontend/content/site.config.ts` → `brand` |
| Announcement bar messages        | `site.config.ts` → `announcement`        |
| Navigation & mega-menus          | `site.config.ts` → `nav`                 |
| Homepage hero / tiles / FAQ copy | `site.config.ts` → `home`                |
| Footer links & newsletter copy   | `site.config.ts` → `footer`              |
| Products, prices, images, stock  | `frontend/content/catalog.ts`            |
| Collections                      | `content/catalog.ts` → `collections`     |
| Colors / theme                   | `frontend/app/globals.css` → `:root` tokens |
| Fonts                            | `frontend/app/layout.tsx` (top of file)  |
| Logo image files                 | `frontend/public/brand/`                 |

## Rules

1. **Never hardcode copy, prices, or image URLs inside `components/`.**
   If a request seems to need it, the config schema should grow instead —
   add the field to `site.config.ts` and read it in the component.
2. **Images**: prefer the `px(pexelsId, w, h)` helper for stock photos
   (Pexels, free license) or files under `frontend/public/`. Always set a
   meaningful `alt`. New remote image hosts must be added to
   `next.config.ts` → `images.remotePatterns`.
3. **Adding a product** = copy an existing block in `catalog.ts`, change
   fields, add its id to a collection's `productIds`. Slugs are kebab-case
   and unique. That's the whole job.
4. **Cloning the store to a new genre** (candles, pet gear, sarees…):
   rewrite `site.config.ts` + `catalog.ts` + swap `/public/brand/` assets +
   adjust the `:root` palette in `globals.css`. Components should not change.
5. **After any edit**, run `npm run build` and `npm run test` in
   `frontend/`. Both must pass before committing.
6. **Money**: prices are integer rupees in `catalog.ts` (`price`, `mrp`).
   `mrp` must be ≥ `price`. Sale badges derive automatically from
   `mrp > price` and `isSale`.

## Tone of voice (for copy edits)

Warm, specific, unhurried. Short sentences. India-aware details (monsoon
commutes, wedding season, ₹ prices). Never write "elevate", "curated", or
"luxurious" — show the material fact instead ("22-momme mulberry silk").
