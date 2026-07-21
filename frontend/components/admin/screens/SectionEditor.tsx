"use client";

// Homepage sections editor: drag to reorder, toggle to hide, edit content
// inline. LOCAL-ONLY for now — there is no homepage-sections backend, so
// changes live in browser state and do not persist or reach the storefront yet.

import {
  Images,
  Layers,
  LayoutGrid,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  GripVertical,
} from "lucide-react";

import { uid } from "@/lib/admin/helpers";
import type { AdminSection, SectionType } from "@/lib/admin/types";
import { inputCls, Toggle, useDnd } from "../atoms";
import { ImageDrop } from "../ImageDrop";

const ADD_MENU: [SectionType, string][] = [
  ["announcement", "Announcement bar"],
  ["hero", "Hero banner"],
  ["trust", "Trust strip"],
  ["categories", "Categories row"],
  ["featured", "Featured products"],
  ["storyBanner", "Story banner"],
  ["grid", "Full product grid"],
];

const iconFor = (t: SectionType) =>
  ({
    announcement: <Megaphone className="h-4 w-4" />,
    hero: <Images className="h-4 w-4" />,
    trust: <ShieldCheck className="h-4 w-4" />,
    categories: <Layers className="h-4 w-4" />,
    featured: <Star className="h-4 w-4" />,
    storyBanner: <Sparkles className="h-4 w-4" />,
    grid: <LayoutGrid className="h-4 w-4" />,
  })[t];

const labelFor = (t: SectionType) => ADD_MENU.find(([id]) => id === t)?.[1] ?? t;

export function SectionEditor({
  sections,
  setSections,
}: {
  sections: AdminSection[];
  setSections: (next: AdminSection[]) => void;
}) {
  const dnd = useDnd(sections, setSections);
  const update = (id: string, k: keyof AdminSection, v: unknown) =>
    setSections(sections.map((s) => (s.id === id ? { ...s, [k]: v } : s)));
  const remove = (id: string) => setSections(sections.filter((s) => s.id !== id));
  const move = (id: string, dir: number) => {
    const i = sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
  };
  const add = (type: SectionType) => {
    const defaults: Record<SectionType, Partial<AdminSection>> = {
      announcement: { text: "New announcement" },
      hero: { heading: "New heading", sub: "New subtitle", ctaLabel: "Shop now", image: "" },
      trust: {},
      categories: { heading: "Shop by category" },
      featured: { heading: "Featured" },
      storyBanner: { heading: "New story", sub: "Description", ctaLabel: "Explore" },
      grid: { heading: "All products" },
    };
    setSections([...sections, { id: `sec-${uid()}`, type, on: true, ...defaults[type] }]);
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-ink">Homepage sections</h2>
          <p className="text-sm text-ink-soft">
            Drag to reorder · toggle to hide · edit content inline.{" "}
            <span className="font-semibold text-gold">Local preview only — not yet saved to the storefront.</span>
          </p>
        </div>
        <div className="group relative">
          <button className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white">
            + Add section
          </button>
          <div className="pointer-events-none absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-ink/10 bg-card p-1 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100">
            {ADD_MENU.map(([t, l]) => (
              <button
                key={t}
                onClick={() => add(t)}
                className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-ink hover:bg-teal/10"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((s) => (
          <div
            key={s.id}
            draggable
            onDragStart={dnd.onDragStart(s.id)}
            onDragOver={dnd.onDragOver(s.id)}
            onDrop={dnd.onDrop}
            onDragEnd={dnd.onDragEnd}
            className={`rounded-xl border bg-card p-3 transition ${dnd.overId === s.id ? "border-teal ring-2 ring-teal/15" : "border-ink/10"} ${dnd.dragId === s.id ? "opacity-50" : ""}`}
          >
            <div className="flex items-center gap-3">
              <span className="cursor-grab text-ink-soft/40 hover:text-ink-soft">
                <GripVertical className="h-5 w-5" />
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-teal/10 text-teal">
                {iconFor(s.type)}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">{labelFor(s.type)}</div>
                <div className="line-clamp-1 text-xs text-ink-soft">{s.text || s.heading || "—"}</div>
              </div>
              <Toggle on={s.on} onChange={(v) => update(s.id, "on", v)} />
              <button onClick={() => move(s.id, -1)} className="rounded-md p-1 text-ink-soft/60 hover:bg-ink/5">↑</button>
              <button onClick={() => move(s.id, 1)} className="rounded-md p-1 text-ink-soft/60 hover:bg-ink/5">↓</button>
              <button onClick={() => remove(s.id)} className="rounded-md p-1 text-sale hover:bg-sale/5">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {s.type === "announcement" && (
              <input
                className={inputCls + " mt-3"}
                value={s.text ?? ""}
                onChange={(e) => update(s.id, "text", e.target.value)}
                placeholder="Announcement text"
              />
            )}
            {s.type === "hero" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className={inputCls} value={s.heading ?? ""} onChange={(e) => update(s.id, "heading", e.target.value)} placeholder="Heading" />
                <input className={inputCls} value={s.sub ?? ""} onChange={(e) => update(s.id, "sub", e.target.value)} placeholder="Subtitle" />
                <input className={inputCls} value={s.ctaLabel ?? ""} onChange={(e) => update(s.id, "ctaLabel", e.target.value)} placeholder="Button label" />
                <div className="sm:col-span-2">
                  <ImageDrop value={s.image ?? ""} onChange={(v) => update(s.id, "image", v)} compact />
                </div>
              </div>
            )}
            {(s.type === "categories" || s.type === "featured" || s.type === "grid") && (
              <input
                className={inputCls + " mt-3"}
                value={s.heading ?? ""}
                onChange={(e) => update(s.id, "heading", e.target.value)}
                placeholder="Section heading"
              />
            )}
            {s.type === "storyBanner" && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input className={inputCls} value={s.heading ?? ""} onChange={(e) => update(s.id, "heading", e.target.value)} placeholder="Heading" />
                <input className={inputCls} value={s.sub ?? ""} onChange={(e) => update(s.id, "sub", e.target.value)} placeholder="Subtitle" />
                <input className={inputCls} value={s.ctaLabel ?? ""} onChange={(e) => update(s.id, "ctaLabel", e.target.value)} placeholder="Button label" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
