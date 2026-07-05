/**
 * Compatibility shim — the catalog now lives in `content/catalog.ts`
 * (single editable source of truth). This file re-exports it so older
 * imports and tests keep working. Edit content/, not this file.
 */
export {
  collections,
  products,
  getCollectionBySlug,
  getProductsByCollectionSlug,
  getProductBySlug,
} from "@/content/catalog";
