"use client";

// Arrange the homepage: which sections appear, and in what order.
//
// Saving goes through PUT /api/content/site, which is a WHOLE-DOCUMENT
// REPLACE -- deliberately, so that deleting a nav entry or an FAQ is
// expressible. That makes the obvious implementation of this screen
// catastrophic: a builder that knows only about `home.layout` and PUTs what it
// holds would erase brand, nav, footer, policy copy and every section's words.
//
// So it reads the document, splices the layout into it, and sends the whole
// thing back with the version it read. The version is what stops two people
// with the screen open from silently overwriting each other.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Save } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import {
  DEFAULT_HOME_LAYOUT,
  HOME_SECTION_LABELS,
  type HomeLayoutEntry,
  encodeLayout,
  resolveLayout,
} from "@/lib/home-layout";
import { moveEntry } from "@/lib/reorder";

type SiteDocument = {
  key: string;
  version: number;
  document: Record<string, unknown>;
};

export function LayoutBuilder() {
  const [layout, setLayout] = useState<HomeLayoutEntry[]>(DEFAULT_HOME_LAYOUT);
  const [doc, setDoc] = useState<SiteDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/content/site")
      .then(async (res) => {
        if (!res?.ok) return setError("Couldn't load the site content.");
        const body = (await res.json()) as SiteDocument;
        setDoc(body);
        const home = body.document.home as { layout?: unknown } | undefined;
        setLayout(resolveLayout(home?.layout));
      })
      .catch(() => setError("Couldn't load the site content."))
      .finally(() => setLoading(false));
  }, []);

  const move = (index: number, direction: -1 | 1) =>
    setLayout((current) => moveEntry(current, index, direction));

  const toggle = (index: number) =>
    setLayout((current) =>
      current.map((entry, i) => (i === index ? { ...entry, visible: !entry.visible } : entry)),
    );

  // The preview follows the draft, so the iframe src has to change with it.
  const previewSrc = useMemo(
    () => `/preview/home?layout=${encodeURIComponent(encodeLayout(layout))}`,
    [layout],
  );

  const save = useCallback(async () => {
    if (!doc) return;
    setSaving(true);
    setError(null);

    // Spliced into the document that was read, never assembled from scratch.
    const home = (doc.document.home ?? {}) as Record<string, unknown>;
    const next = { ...doc.document, home: { ...home, layout } };

    const res = await apiFetch("/api/content/site", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: next, expected_version: doc.version }),
    });
    setSaving(false);

    if (res?.ok) {
      setDoc((await res.json()) as SiteDocument);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return;
    }
    if (res?.status === 409) {
      setError(
        "Somebody else saved the site content while this was open. Reload the page to pick up their change, then reorder again.",
      );
      return;
    }
    setError(
      res && (res.status === 401 || res.status === 403)
        ? "Your admin session has expired. Please log out and log back in."
        : "Couldn't save the layout.",
    );
  }, [doc, layout]);

  if (loading) return <p className="text-sm text-ink-soft">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl italic text-ink">Homepage layout</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Move sections and switch them off. The preview shows the arrangement before you save.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !doc}
          className="inline-flex items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : saved ? "Saved" : "Save layout"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-sale/10 px-3 py-2 text-sm text-sale">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <ol className="space-y-2">
          {layout.map((entry, index) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white p-3"
            >
              <span
                className={`flex-1 text-sm ${entry.visible ? "text-ink" : "text-ink-soft line-through"}`}
              >
                {HOME_SECTION_LABELS[entry.id]}
              </span>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded-md p-1.5 text-ink-soft hover:bg-ink/5 disabled:opacity-30"
                aria-label={`Move ${HOME_SECTION_LABELS[entry.id]} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === layout.length - 1}
                className="rounded-md p-1.5 text-ink-soft hover:bg-ink/5 disabled:opacity-30"
                aria-label={`Move ${HOME_SECTION_LABELS[entry.id]} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => toggle(index)}
                aria-pressed={entry.visible}
                className="rounded-md p-1.5 text-ink-soft hover:bg-ink/5"
                aria-label={`${entry.visible ? "Hide" : "Show"} ${HOME_SECTION_LABELS[entry.id]}`}
              >
                {entry.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </li>
          ))}
        </ol>

        <div className="overflow-hidden rounded-xl border border-ink/10 bg-white">
          <p className="border-b border-ink/10 px-3 py-2 text-xs uppercase tracking-wide text-ink-soft">
            Preview — not saved yet
          </p>
          {/* Keyed by src so a reorder remounts the frame rather than relying on
              the browser to re-request a URL it may consider unchanged. */}
          <iframe
            key={previewSrc}
            src={previewSrc}
            title="Homepage preview"
            className="h-[70vh] w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
