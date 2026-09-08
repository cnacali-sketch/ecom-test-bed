"use client";

// Grid of products to pick one to edit, plus a "New product" button.

import { Search, Sparkles } from "lucide-react";
import { useState } from "react";

import { rupee } from "@/lib/admin/helpers";
import type { AdminProduct } from "@/lib/admin/types";
import type { LoadState } from "../AdminApp";
import { inputCls } from "../atoms";

export function ProductList({
  products,
  onOpen,
  onNew,
  loadState = "ready",
}: {
  products: AdminProduct[];
  onOpen: (id: string) => void;
  onNew: () => void;
  /** Whether the catalogue actually loaded. Without it an unreachable backend
   * renders as "No products match" — blaming the search box for an outage. */
  loadState?: LoadState;
}) {
  const [q, setQ] = useState("");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className={inputCls + " pl-9"}
          />
        </div>
        <button onClick={onNew} className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white">
          + New product
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => onOpen(p.id)}
            className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-card p-3 text-left transition hover:border-teal/40 hover:shadow-md"
          >
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal/15 to-gold/15 text-teal">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt="" className="h-full w-full rounded-xl object-cover" />
              ) : (
                <Sparkles className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">{p.name || "Untitled"}</div>
              <div className="text-xs text-ink-soft">{p.category || "—"}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-bold text-ink">{rupee(p.price)}</span>
                <span
                  className={`text-[10px] font-bold uppercase ${p.published ? "text-teal" : "text-ink-soft/50"}`}
                >
                  {p.published ? "● Live" : "○ Hidden"}
                </span>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm">
            {loadState === "loading" && <span className="text-ink-soft/70">Loading products…</span>}
            {loadState === "error" && (
              <span className="text-sale">
                Couldn&apos;t load the catalogue. This is a connection or sign-in problem, not an
                empty shop — reload once you&apos;re back online.
              </span>
            )}
            {loadState === "ready" &&
              (products.length === 0 ? (
                <span className="text-ink-soft/70">
                  No products yet. Use “+ New product” to add your first one.
                </span>
              ) : (
                <span className="text-ink-soft/70">No products match “{q}”.</span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
