/**
 * Compatibility shim — navigation now lives in `content/site.config.ts`.
 * Edit the `nav` array there; components import from here unchanged.
 */
import { siteConfig } from "@/content/site.config";
export type { NavItem } from "@/content/site.config";
export const NAV_ITEMS = siteConfig.nav;
