"use client";

// Homepage editor: every real, independently-rendered piece of the
// homepage (announcement ribbon, hero, quick CTAs, New In heading, campaign
// band, editorial tiles, SEO/brand-story block) — backed by GET/PUT
// /api/sections (see backend/app/routers/sections.py). Fields load prefilled
// with the site's actual current copy (site.config.ts defaults merged with
// any saved override) so the admin always sees exactly what's live, not a
// blank form. Clearing a field back to empty reverts that field to the
// site.config.ts default on save — the storefront components fall back with
// `override || default`, so an empty override is equivalent to no override.
//
// Earlier version of this screen modeled toggleable "trust strip / featured
// products / story banner / grid" sections that don't correspond to any
// real conditionally-rendered homepage component — editing them changed
// nothing on the actual site. Removed rather than wired up fake, since
// persisting data that still doesn't affect the page is worse than an
// honest "not built yet."

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { siteConfig } from "@/content/site.config";
import { inputCls, Toggle } from "../atoms";
import { ImageDrop } from "../ImageDrop";

interface QuickCta {
  label: string;
  href: string;
  image: string;
}

interface EditorialTile {
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  image: string;
  imageAlt: string;
}

interface SeoCategory {
  title: string;
  copy: string;
  href: string;
}

interface SeoFaq {
  q: string;
  a: string;
}

interface HomepageContent {
  announcement_enabled: boolean | null;
  announcement_messages: string[] | null;
  hero_accent_word: string | null;
  hero_headline: string | null;
  hero_subline: string | null;
  hero_cta_label: string | null;
  hero_cta_href: string | null;
  hero_image: string | null;
  hero_image_alt: string | null;
  quick_ctas: QuickCta[] | null;
  new_in_heading: string | null;
  new_in_sub: string | null;
  campaign_eyebrow: string | null;
  campaign_title_italic: string | null;
  campaign_title: string | null;
  campaign_copy: string | null;
  campaign_cta_label: string | null;
  campaign_cta_href: string | null;
  campaign_image: string | null;
  campaign_image_alt: string | null;
  editorial_tiles: EditorialTile[] | null;
  seo_brand_story: string | null;
  seo_categories: SeoCategory[] | null;
  seo_faqs: SeoFaq[] | null;
}

/** The site's actual current copy — what a visitor sees right now with no override saved. */
const DEFAULTS: HomepageContent = {
  announcement_enabled: siteConfig.announcement.enabled,
  announcement_messages: [...siteConfig.announcement.messages],
  hero_accent_word: siteConfig.home.hero.accentWord,
  hero_headline: siteConfig.home.hero.headline,
  hero_subline: siteConfig.home.hero.subline,
  hero_cta_label: siteConfig.home.hero.ctaLabel,
  hero_cta_href: siteConfig.home.hero.ctaHref,
  hero_image: siteConfig.home.hero.image,
  hero_image_alt: siteConfig.home.hero.imageAlt,
  quick_ctas: siteConfig.home.quickCtas.map((c) => ({ ...c })),
  new_in_heading: siteConfig.home.newInHeading,
  new_in_sub: siteConfig.home.newInSub,
  campaign_eyebrow: siteConfig.home.campaign.eyebrow,
  campaign_title_italic: siteConfig.home.campaign.titleItalic,
  campaign_title: siteConfig.home.campaign.title,
  campaign_copy: siteConfig.home.campaign.copy,
  campaign_cta_label: siteConfig.home.campaign.ctaLabel,
  campaign_cta_href: siteConfig.home.campaign.ctaHref,
  campaign_image: siteConfig.home.campaign.image,
  campaign_image_alt: siteConfig.home.campaign.imageAlt,
  editorial_tiles: siteConfig.home.editorialTiles.map((t) => ({ ...t })),
  seo_brand_story: siteConfig.home.seo.brandStory,
  seo_categories: siteConfig.home.seo.categories.map((c) => ({ ...c })),
  seo_faqs: siteConfig.home.seo.faqs.map((f) => ({ ...f })),
};

/** Fetched row (all-null on a fresh install) merged over DEFAULTS, field by field. */
function fillWithDefaults(fetched: HomepageContent): HomepageContent {
  return {
    announcement_enabled: fetched.announcement_enabled ?? DEFAULTS.announcement_enabled,
    announcement_messages: fetched.announcement_messages?.length
      ? fetched.announcement_messages
      : DEFAULTS.announcement_messages,
    hero_accent_word: fetched.hero_accent_word || DEFAULTS.hero_accent_word,
    hero_headline: fetched.hero_headline || DEFAULTS.hero_headline,
    hero_subline: fetched.hero_subline || DEFAULTS.hero_subline,
    hero_cta_label: fetched.hero_cta_label || DEFAULTS.hero_cta_label,
    hero_cta_href: fetched.hero_cta_href || DEFAULTS.hero_cta_href,
    hero_image: fetched.hero_image || DEFAULTS.hero_image,
    hero_image_alt: fetched.hero_image_alt || DEFAULTS.hero_image_alt,
    quick_ctas: fetched.quick_ctas?.length ? fetched.quick_ctas : DEFAULTS.quick_ctas,
    new_in_heading: fetched.new_in_heading || DEFAULTS.new_in_heading,
    new_in_sub: fetched.new_in_sub || DEFAULTS.new_in_sub,
    campaign_eyebrow: fetched.campaign_eyebrow || DEFAULTS.campaign_eyebrow,
    campaign_title_italic: fetched.campaign_title_italic || DEFAULTS.campaign_title_italic,
    campaign_title: fetched.campaign_title || DEFAULTS.campaign_title,
    campaign_copy: fetched.campaign_copy || DEFAULTS.campaign_copy,
    campaign_cta_label: fetched.campaign_cta_label || DEFAULTS.campaign_cta_label,
    campaign_cta_href: fetched.campaign_cta_href || DEFAULTS.campaign_cta_href,
    campaign_image: fetched.campaign_image || DEFAULTS.campaign_image,
    campaign_image_alt: fetched.campaign_image_alt || DEFAULTS.campaign_image_alt,
    editorial_tiles: fetched.editorial_tiles?.length ? fetched.editorial_tiles : DEFAULTS.editorial_tiles,
    seo_brand_story: fetched.seo_brand_story || DEFAULTS.seo_brand_story,
    seo_categories: fetched.seo_categories?.length ? fetched.seo_categories : DEFAULTS.seo_categories,
    seo_faqs: fetched.seo_faqs?.length ? fetched.seo_faqs : DEFAULTS.seo_faqs,
  };
}

type FieldSpec<T> = { key: keyof T; placeholder: string; type?: "text" | "textarea" | "image" };

/** Shared add/edit/remove list editor for the four repeating homepage sections. */
function RepeatableList<T extends object>({
  items,
  setItems,
  fields,
  itemLabel,
  makeEmpty,
}: {
  items: T[];
  setItems: (next: T[]) => void;
  fields: FieldSpec<T>[];
  itemLabel: string;
  makeEmpty: () => T;
}) {
  const updateItem = (index: number, key: keyof T, value: string) =>
    setItems(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));

  const fieldValue = (item: T, key: keyof T): string => (item[key] as unknown as string) ?? "";

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={index} className="rounded-xl border border-ink/10 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {itemLabel} {index + 1}
            </span>
            <button
              type="button"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
              className="rounded-md p-1.5 text-sale hover:bg-sale/5"
              aria-label={`Remove ${itemLabel.toLowerCase()}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {fields.map((f) =>
              f.type === "image" ? (
                <div key={String(f.key)} className="sm:col-span-2">
                  <ImageDrop value={fieldValue(item, f.key)} onChange={(v) => updateItem(index, f.key, v)} compact />
                </div>
              ) : f.type === "textarea" ? (
                <textarea
                  key={String(f.key)}
                  className={inputCls + " sm:col-span-2"}
                  rows={2}
                  value={fieldValue(item, f.key)}
                  onChange={(e) => updateItem(index, f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              ) : (
                <input
                  key={String(f.key)}
                  className={inputCls}
                  value={fieldValue(item, f.key)}
                  onChange={(e) => updateItem(index, f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              ),
            )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setItems([...items, makeEmpty()])}
        className="flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> Add {itemLabel.toLowerCase()}
      </button>
    </div>
  );
}

export function SectionEditor() {
  const [content, setContent] = useState<HomepageContent>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/api/sections")
      .then(async (res) => {
        if (!res?.ok) return setError("Couldn't load homepage content.");
        setContent(fillWithDefaults((await res.json()) as HomepageContent));
      })
      .catch(() => setError("Couldn't load homepage content."))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof HomepageContent>(key: K, value: HomepageContent[K]) =>
    setContent((c) => ({ ...c, [key]: value }));

  const messages = content.announcement_messages ?? [];
  const setMessages = (next: string[]) => set("announcement_messages", next);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await apiFetch("/api/sections", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });
    setSaving(false);
    if (res?.ok) {
      setContent(fillWithDefaults((await res.json()) as HomepageContent));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }
    setError(
      res && (res.status === 401 || res.status === 403)
        ? "Your admin session has expired. Please log out and log back in."
        : "Couldn't save. Please try again.",
    );
  }

  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading homepage content…</p>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-sale/30 bg-sale/5 px-4 py-3 text-xs text-sale">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold uppercase tracking-wide hover:underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Announcement bar</h2>
          <Toggle on={content.announcement_enabled ?? true} onChange={(v) => set("announcement_enabled", v)} />
        </div>
        <div className="space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputCls}
                value={msg}
                onChange={(e) => setMessages(messages.map((m, j) => (j === i ? e.target.value : m)))}
                placeholder="Announcement message"
              />
              <button
                type="button"
                onClick={() => setMessages(messages.filter((_, j) => j !== i))}
                className="rounded-md p-2 text-sale hover:bg-sale/5"
                aria-label="Remove message"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setMessages([...messages, ""])}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal hover:underline"
          >
            <Plus className="h-3.5 w-3.5" /> Add message
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-ink">Hero banner</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inputCls} value={content.hero_accent_word ?? ""} onChange={(e) => set("hero_accent_word", e.target.value)} placeholder="Accent word (e.g. New drop)" />
          <input className={inputCls} value={content.hero_headline ?? ""} onChange={(e) => set("hero_headline", e.target.value)} placeholder="Headline" />
          <input className={inputCls} value={content.hero_subline ?? ""} onChange={(e) => set("hero_subline", e.target.value)} placeholder="Subline" />
          <input className={inputCls} value={content.hero_cta_label ?? ""} onChange={(e) => set("hero_cta_label", e.target.value)} placeholder="Button label" />
          <input className={inputCls + " sm:col-span-2"} value={content.hero_cta_href ?? ""} onChange={(e) => set("hero_cta_href", e.target.value)} placeholder="Button link (e.g. /collections/hair-accessories)" />
          <div className="sm:col-span-2">
            <ImageDrop value={content.hero_image ?? ""} onChange={(v) => set("hero_image", v)} compact />
          </div>
          <input className={inputCls + " sm:col-span-2"} value={content.hero_image_alt ?? ""} onChange={(e) => set("hero_image_alt", e.target.value)} placeholder="Image alt text (for screen readers)" />
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-ink">Quick CTA tiles</h2>
        <RepeatableList<QuickCta>
          items={content.quick_ctas ?? []}
          setItems={(next) => set("quick_ctas", next)}
          itemLabel="Tile"
          makeEmpty={() => ({ label: "", href: "", image: "" })}
          fields={[
            { key: "label", placeholder: "Label (e.g. Claw Clips)" },
            { key: "href", placeholder: "Link (e.g. /collections/hair-accessories)" },
            { key: "image", placeholder: "Image", type: "image" },
          ]}
        />
      </div>

      <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-ink">"New In" section heading</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inputCls} value={content.new_in_heading ?? ""} onChange={(e) => set("new_in_heading", e.target.value)} placeholder="Heading (e.g. New In)" />
          <input className={inputCls} value={content.new_in_sub ?? ""} onChange={(e) => set("new_in_sub", e.target.value)} placeholder="Subheading" />
        </div>
        <p className="mt-3 text-xs text-ink-soft">The products shown below this heading come from Inventory, not from here.</p>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-ink">Campaign band</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input className={inputCls} value={content.campaign_eyebrow ?? ""} onChange={(e) => set("campaign_eyebrow", e.target.value)} placeholder="Eyebrow (e.g. The Teal Edit)" />
          <input className={inputCls} value={content.campaign_title_italic ?? ""} onChange={(e) => set("campaign_title_italic", e.target.value)} placeholder="Large italic word (e.g. Signed)" />
          <input className={inputCls} value={content.campaign_title ?? ""} onChange={(e) => set("campaign_title", e.target.value)} placeholder="Title line" />
          <input className={inputCls} value={content.campaign_cta_label ?? ""} onChange={(e) => set("campaign_cta_label", e.target.value)} placeholder="Button label" />
          <textarea className={inputCls + " sm:col-span-2"} rows={2} value={content.campaign_copy ?? ""} onChange={(e) => set("campaign_copy", e.target.value)} placeholder="Body copy" />
          <input className={inputCls + " sm:col-span-2"} value={content.campaign_cta_href ?? ""} onChange={(e) => set("campaign_cta_href", e.target.value)} placeholder="Button link" />
          <div className="sm:col-span-2">
            <ImageDrop value={content.campaign_image ?? ""} onChange={(v) => set("campaign_image", v)} compact />
          </div>
          <input className={inputCls + " sm:col-span-2"} value={content.campaign_image_alt ?? ""} onChange={(e) => set("campaign_image_alt", e.target.value)} placeholder="Image alt text" />
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-ink">Editorial tiles</h2>
        <RepeatableList<EditorialTile>
          items={content.editorial_tiles ?? []}
          setItems={(next) => set("editorial_tiles", next)}
          itemLabel="Tile"
          makeEmpty={() => ({ eyebrow: "", title: "", copy: "", href: "", image: "", imageAlt: "" })}
          fields={[
            { key: "eyebrow", placeholder: "Eyebrow (e.g. The Edit)" },
            { key: "title", placeholder: "Title" },
            { key: "copy", placeholder: "Copy", type: "textarea" },
            { key: "href", placeholder: "Link" },
            { key: "image", placeholder: "Image", type: "image" },
            { key: "imageAlt", placeholder: "Image alt text" },
          ]}
        />
      </div>

      <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-ink">Brand story &amp; FAQ</h2>
        <textarea
          className={inputCls}
          rows={4}
          value={content.seo_brand_story ?? ""}
          onChange={(e) => set("seo_brand_story", e.target.value)}
          placeholder="Brand story paragraph"
        />
        <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">Category blurbs</h3>
        <RepeatableList<SeoCategory>
          items={content.seo_categories ?? []}
          setItems={(next) => set("seo_categories", next)}
          itemLabel="Category"
          makeEmpty={() => ({ title: "", copy: "", href: "" })}
          fields={[
            { key: "title", placeholder: "Title (e.g. Jewellery)" },
            { key: "copy", placeholder: "Copy", type: "textarea" },
            { key: "href", placeholder: "Link" },
          ]}
        />
        <h3 className="mb-2 mt-6 text-sm font-semibold text-ink">FAQs</h3>
        <RepeatableList<SeoFaq>
          items={content.seo_faqs ?? []}
          setItems={(next) => set("seo_faqs", next)}
          itemLabel="Question"
          makeEmpty={() => ({ q: "", a: "" })}
          fields={[
            { key: "q", placeholder: "Question" },
            { key: "a", placeholder: "Answer", type: "textarea" },
          ]}
        />
      </div>

      <p className="text-xs text-ink-soft">Clear any field to blank and save to revert it to the site's default.</p>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="bg-teal px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-white hover:bg-teal-deep disabled:opacity-60"
      >
        {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
      </button>
    </div>
  );
}
