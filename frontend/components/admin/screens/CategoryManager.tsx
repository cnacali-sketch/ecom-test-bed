"use client";

// Category CRUD with drag-reorder. Backed by GET/POST/PATCH/DELETE/PUT
// /api/categories (see backend/app/routers/categories.py). `categories` is
// owned by AdminApp (shared with ProductEditor/Inventory's datalist); this
// screen calls the real endpoints and syncs that shared copy from the
// server's response so all three stay consistent.

import { useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api-client";
import { IMG_SPECS, type AdminCategory, type AdminProduct } from "@/lib/admin/types";
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
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState(PARENTS[0]);
  const [error, setError] = useState<string | null>(null);

  function authError(status: number | undefined): string {
    if (status === 401 || status === 403) return "Your admin session has expired. Please log out and log back in.";
    return "That didn't save. Please try again.";
  }

  async function add() {
    const n = newName.trim();
    if (!n) return;
    const res = await apiFetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, parent: newParent }),
    });
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.detail ?? authError(res?.status));
      return;
    }
    const created = (await res.json()) as AdminCategory;
    setCategories([...categories, created]);
    setNewName("");
    setError(null);
  }

  async function update(id: string, patch: Partial<Pick<AdminCategory, "name" | "parent" | "image">>) {
    const res = await apiFetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res?.ok) {
      setError(authError(res?.status));
      return;
    }
    const updated = (await res.json()) as AdminCategory;
    setCategories(categories.map((c) => (c.id === id ? updated : c)));
    setError(null);
  }

  async function remove(id: string) {
    const c = categories.find((x) => x.id === id);
    const inUse = products.filter((p) => p.category === c?.name).length;
    if (inUse > 0 && !confirm(`${c?.name} is used by ${inUse} product${inUse > 1 ? "s" : ""}. Remove anyway?`)) return;
    const res = await apiFetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!res?.ok && res?.status !== 204) {
      setError(authError(res?.status));
      return;
    }
    setCategories(categories.filter((x) => x.id !== id));
    setError(null);
  }

  async function reorder(next: AdminCategory[]) {
    setCategories(next); // optimistic — drag-drop should feel instant
    const res = await apiFetch("/api/categories/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: next.map((c) => c.id) }),
    });
    if (!res?.ok) setError(authError(res?.status));
  }

  const dnd = useDnd(categories, reorder);

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink">Categories</h2>
        <p className="text-sm text-ink-soft">Drag to reorder. Used to tag products for internal reporting.</p>
      </div>
      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-sale/30 bg-sale/5 px-4 py-3 text-xs text-sale">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="font-semibold uppercase tracking-wide hover:underline">
            Dismiss
          </button>
        </div>
      )}
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
                <ImageDrop value={c.image} onChange={(v) => update(c.id, { image: v })} compact spec={IMG_SPECS.tile} />
              </div>
              {/* Uncontrolled + commit on blur, same idiom as Inventory's cells.
                  Bound straight to `update`, this fired one PATCH per character
                  typed — a dozen racing writes to rename a category, with the
                  value coming back from the server so typing fought the
                  round-trip. `key` re-seeds it once the server confirms. */}
              <input
                key={c.name}
                className={inputCls + " max-w-xs"}
                defaultValue={c.name}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next && next !== c.name) update(c.id, { name: next });
                  else e.target.value = c.name;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") {
                    e.currentTarget.value = c.name;
                    e.currentTarget.blur();
                  }
                }}
              />
              <select
                className={inputCls + " max-w-[160px]"}
                value={c.parent}
                onChange={(e) => update(c.id, { parent: e.target.value })}
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
