"use client";

// Homepage editor: the announcement ribbon and hero banner — the two real,
// independently-rendered pieces of the homepage that can be safely
// overridden per-field. Backed by GET/PUT /api/sections (see
// backend/app/routers/sections.py); a null field means "use
// content/site.config.ts's default," so leaving a field blank here doesn't
// erase the site's copy, it just stops overriding it.
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
import { inputCls, Toggle } from "../atoms";
import { ImageDrop } from "../ImageDrop";

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
}

const EMPTY: HomepageContent = {
  announcement_enabled: null,
  announcement_messages: null,
  hero_accent_word: null,
  hero_headline: null,
  hero_subline: null,
  hero_cta_label: null,
  hero_cta_href: null,
  hero_image: null,
  hero_image_alt: null,
};

export function SectionEditor() {
  const [content, setContent] = useState<HomepageContent>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch("/api/sections")
      .then(async (res) => {
        if (!res?.ok) return setError("Couldn't load homepage content.");
        setContent((await res.json()) as HomepageContent);
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
      setContent((await res.json()) as HomepageContent);
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
        <p className="mt-3 text-xs text-ink-soft">Leave empty to use the site's default messages.</p>
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
        <p className="mt-3 text-xs text-ink-soft">Leave any field empty to keep the site's default for that field.</p>
      </div>

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
