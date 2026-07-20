"use client";

// Category CRUD with drag-reorder. LOCAL-ONLY for now — the backend has a
// `collections` table but no category-management API, so edits live in browser
// state and don't persist yet.

import { GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";

import { uid } from "@/lib/admin/helpers";
import type { AdminCategory, AdminProduct } from "@/lib/admin/types";
import { inputCls, useDnd } from "../atoms";
import { ImageDrop } from "../ImageDrop";

const PARENTS = ["Hair Accessories", "Jewellery", "Bridal", "Festive Edit"];

export function CategoryManager({
  categories,
  setCategories,
  products,
}: {
  categories: AdminCategory[];
  setCategories: (next: AdminCategory[]) => void;
  products: AdminProduct[];
}) {
  const dnd = useDnd(categories, setCategories);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState(PARENTS[0]);

  const add = () => {
    const n = newName.trim();
    if (!n) return;
    setCategories([
      ...categories,
      { id: `c-${uid()}`, name: n, parent: newParent, slug: n.toLowerCase().replace(/\s+/g, "-"), image: "" },
    ]);
    setNewName("");
  };
  const update = (id: string, k: keyof AdminCategory, v: string) =>
    setCategories(categories.map((c) => (c.id === id ? { ...c, [k]: v } : c)));
  const remove = (id: string) => {
    const c = categories.find((x) => x.id === id);
    const inUse = products.filter((p) => p.category === c?.name).length;
    if (inUse > 0 && !confirm(`${c?.name} is used by ${inUse} product${inUse > 1 ? "s" : ""}. Remove anyway?`))
      return;
    setCategories(categories.filter((x) => x.id !== id));
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink">Categories</h2>
        <p className="text-sm text-ink-soft">
          Drag to reorder.{" "}
          <span className="font-semibold text-gold">Local only — not yet saved to the storefront.</span>
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className={inputCls + " max-w-xs"}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <select
          className={inputCls + " max-w-[180px]"}
          value={newParent}
          onChange={(e) => setNewParent(e.target.value)}
        >
          {PARENTS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <button onClick={add} className="rounded-xl bg-teal px-4 text-sm font-semibold text-white">
          Add
        </button>
      </div>
      <div className="space-y-2">
        {categories.map((c) => {
          const count = products.filter((p) => p.category === c.name).length;
          return (
            <div
              key={c.id}
              draggable
              onDragStart={dnd.onDragStart(c.id)}
              onDragOver={dnd.onDragOver(c.id)}
              onDrop={dnd.onDrop}
              onDragEnd={dnd.onDragEnd}
              className={`flex items-center gap-3 rounded-xl border bg-card p-3 transition ${dnd.overId === c.id ? "border-teal ring-2 ring-teal/15" : "border-ink/10"} ${dnd.dragId === c.id ? "opacity-50" : ""}`}
            >
              <span className="cursor-grab text-ink-soft/40">
                <GripVertical className="h-5 w-5" />
              </span>
              <div className="h-12 w-12 shrink-0">
                <ImageDrop value={c.image} onChange={(v) => update(c.id, "image", v)} compact />
              </div>
              <input
                className={inputCls + " max-w-xs"}
                value={c.name}
                onChange={(e) => update(c.id, "name", e.target.value)}
              />
              <select
                className={inputCls + " max-w-[160px]"}
                value={c.parent}
                onChange={(e) => update(c.id, "parent", e.target.value)}
              >
                {PARENTS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <span className="text-xs text-ink-soft/70">
                {count} product{count === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => remove(c.id)}
                className="ml-auto rounded-md p-2 text-sale hover:bg-sale/5"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
