"""Reading and writing the site content document.

Two jobs, and the second one is temporary.

**Defaults.** A fresh install has no content at all, so the document is seeded
from `app/content/site_defaults.json` -- a generated export of the frontend's
`content/site.config.ts`, produced by `frontend/scripts/export-site-content.mjs`.
It is a starting point, not a live dependency: once the row exists the database
is the only source of truth, and re-exporting changes nothing already seeded.

**The homepage projection.** The storefront currently reads `GET /api/sections`,
which returns the old flat shape -- one key per editable homepage field. Those
fields now live at paths inside the document, so this module maps between the
two. That keeps the live storefront working untouched while the API becomes
something a second storefront could consume, and the mapping can be deleted
once nothing asks for the flat shape any more.
"""
from __future__ import annotations

import copy
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DEFAULTS_PATH = Path(__file__).resolve().parents[1] / "content" / "site_defaults.json"

#: Where each field of the old flat homepage shape lives inside the document.
#:
#: Written out in full rather than derived from the column names. A rule like
#: "hero_cta_label -> home.hero.ctaLabel" would have to guess at casing and at
#: which prefix is a section, and a wrong guess here silently drops a field
#: rather than failing -- the shop would save a headline and watch it vanish.
HOMEPAGE_PATHS: dict[str, tuple[str, ...]] = {
    "announcement_enabled": ("announcement", "enabled"),
    "announcement_messages": ("announcement", "messages"),
    "hero_accent_word": ("home", "hero", "accentWord"),
    "hero_headline": ("home", "hero", "headline"),
    "hero_subline": ("home", "hero", "subline"),
    "hero_cta_label": ("home", "hero", "ctaLabel"),
    "hero_cta_href": ("home", "hero", "ctaHref"),
    "hero_image": ("home", "hero", "image"),
    "hero_image_alt": ("home", "hero", "imageAlt"),
    "quick_ctas": ("home", "quickCtas"),
    "new_in_heading": ("home", "newInHeading"),
    "new_in_sub": ("home", "newInSub"),
    "campaign_eyebrow": ("home", "campaign", "eyebrow"),
    "campaign_title_italic": ("home", "campaign", "titleItalic"),
    "campaign_title": ("home", "campaign", "title"),
    "campaign_copy": ("home", "campaign", "copy"),
    "campaign_cta_label": ("home", "campaign", "ctaLabel"),
    "campaign_cta_href": ("home", "campaign", "ctaHref"),
    "campaign_image": ("home", "campaign", "image"),
    "campaign_image_alt": ("home", "campaign", "imageAlt"),
    "editorial_tiles": ("home", "editorialTiles"),
    "seo_brand_story": ("home", "seo", "brandStory"),
    "seo_categories": ("home", "seo", "categories"),
    "seo_faqs": ("home", "seo", "faqs"),
}


@lru_cache(maxsize=1)
def _defaults_raw() -> dict[str, Any]:
    if not DEFAULTS_PATH.exists():  # pragma: no cover - packaging failure
        raise RuntimeError(
            f"Site content defaults missing at {DEFAULTS_PATH}. Regenerate with "
            "`node scripts/export-site-content.mjs` from the frontend."
        )
    return json.loads(DEFAULTS_PATH.read_text(encoding="utf-8"))


def defaults() -> dict[str, Any]:
    """A fresh copy of the seed document.

    Deep-copied on every call because the cached original would otherwise be
    mutated by whoever edits the result -- and since it is cached for the life
    of the process, that corruption would outlive the request that caused it.
    """
    return copy.deepcopy(_defaults_raw())


def get_path(document: dict[str, Any], path: tuple[str, ...]) -> Any:
    """Read a nested value, or None if any step is missing."""
    node: Any = document
    for step in path:
        if not isinstance(node, dict) or step not in node:
            return None
        node = node[step]
    return node


def set_path(document: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    """Write a nested value, creating the branches it needs.

    Mutates in place; callers hold their own copy. A missing intermediate is
    created rather than treated as an error, so a document seeded before a
    section existed can still accept a value for it.
    """
    node = document
    for step in path[:-1]:
        child = node.get(step)
        if not isinstance(child, dict):
            child = {}
            node[step] = child
        node = child
    node[path[-1]] = value


def project_homepage(document: dict[str, Any]) -> dict[str, Any]:
    """The document as the old flat homepage shape."""
    return {field: get_path(document, path) for field, path in HOMEPAGE_PATHS.items()}


def apply_homepage(document: dict[str, Any], flat: dict[str, Any]) -> dict[str, Any]:
    """A copy of `document` with the flat homepage fields written into it.

    The subtle part is what a null means, because the two models disagree.

    In the old table, a null column meant "no override -- fall back to the
    config default", and clearing a field in the editor was how an admin
    reverted it. Here the document *is* the content, with nothing underneath to
    fall back to, so writing the null through would blank the headline instead
    of restoring it.

    So a null restores the packaged default for that field. That reproduces the
    old behaviour exactly: clear the box, get the shipped copy back. Skipping
    nulls instead would have been the quieter bug -- the field would simply
    keep its current value and the admin would think the clear had failed.
    """
    updated = copy.deepcopy(document)
    packaged = defaults()
    for field, path in HOMEPAGE_PATHS.items():
        value = flat.get(field)
        set_path(updated, path, get_path(packaged, path) if value is None else value)
    return updated
