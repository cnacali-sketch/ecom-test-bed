"use client";

// Inventory table with click-to-edit numeric cells.
//
// Each committed edit is persisted immediately: `patch` updates local state
// optimistically and calls `onPersist`, which PUTs the whole product to
// /api/products/{id} and toasts the result (see AdminApp.persistProduct).

import { AlertTriangle, Pencil, Search, Sparkles, HelpCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { marginPct } from "@/lib/admin/helpers";
import { LOW_STOCK, type AdminCategory, type AdminProduct } from "@/lib/admin/types";
import type { LoadState } from "../AdminApp";
import { inputCls } from "../atoms";

type EditCell = { id: string; field: keyof AdminProduct } | null;

const STOCK_LABEL: Record<AdminProduct["stockMode"], string> = {
  hidden: "Count hidden",
  exact: "Exact shown",
  lowOnly: "Shows when low",
};

export function Inventory({
  products,
  setProducts,
  onPersist,
  onOpen,
  categories,
  loadState = "ready",
}: {
  products: AdminProduct[];
  setProducts: (next: AdminProduct[]) => void;
  /** Persist one product after an inline edit commits (PUT to the backend). */
  onPersist: (p: AdminProduct) => void;
  onOpen: (id: string) => void;
  categories: AdminCategory[];
  /** Whether the catalogue actually loaded — same reason as ProductList. */
  loadState?: LoadState;
}) {
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [edit, setEdit] = useState<EditCell>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        (cat === "All" || p.category === cat) &&
        (q === "" || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
    );
  }, [products, search, cat]);

  // Optimistic local update, then persist the whole product. Editing runs one
  // cell at a time on blur, so there's nothing to debounce.
  const patch = (id: string, field: keyof AdminProduct, val: unknown) => {
    const updated = products.map((p) => (p.id === id ? { ...p, [field]: val } : p));
    setProducts(updated);
    const changed = updated.find((p) => p.id === id);
    if (changed) onPersist(changed);
  };

  const NumCell = ({
    p,
    field,
    prefix = "",
    placeholder = "",
  }: {
    p: AdminProduct;
    field: keyof AdminProduct;
    prefix?: string;
    placeholder?: string;
  }) => {
    const active = edit?.id === p.id && edit?.field === field;
    const raw = p[field];
    return active ? (
      <input
        autoFocus
        type="number"
        defaultValue={raw as number}
        onBlur={(e) => {
          patch(p.id, field, e.target.value === "" ? "" : +e.target.value);
          setEdit(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-20 rounded-md border border-teal px-2 py-1 text-sm outline-none ring-2 ring-teal/15"
      />
    ) : (
      <button
        onClick={() => setEdit({ id: p.id, field })}
        className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-teal/10"
      >
        <span>
          {raw === "" || raw == null ? (
            <span className="text-ink-soft/40">{placeholder}</span>
          ) : (
            `${prefix}${Number(raw).toLocaleString("en-IN")}`
          )}
        </span>
        <Pencil className="h-3 w-3 text-ink-soft/40 group-hover:text-teal" />
      </button>
    );
  };

  const CatCell = ({ p }: { p: AdminProduct }) => {
    const active = edit?.id === p.id && edit?.field === "category";
    return active ? (
      <input
        autoFocus
        list="inv-cats"
        defaultValue={p.category}
        onBlur={(e) => {
          patch(p.id, "category", e.target.value);
          setEdit(null);
        }}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="w-36 rounded-md border border-teal px-2 py-1 text-sm outline-none ring-2 ring-teal/15"
      />
    ) : (
      <button
        onClick={() => setEdit({ id: p.id, field: "category" })}
        className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink-soft hover:bg-teal/10"
      >
        <span>{p.category || "—"}</span>
        <Pencil className="h-3 w-3 text-ink-soft/40 group-hover:text-teal" />
      </button>
    );
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
      <datalist id="inv-cats">
        {categories.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Inventory</h2>
          <p className="text-sm text-ink-soft">Click any price, cost, units, cap or category to edit — changes save automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/60" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name…"
              className={inputCls + " w-64 pl-9"}
            />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={inputCls + " w-40"}>
            <option>All</option>
            {categories.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink-soft/60">
              <th className="pb-3 pl-2 font-semibold">Product</th>
              <th className="pb-3 font-semibold">Category</th>
              <th className="pb-3 font-semibold">Price</th>
              <th className="pb-3 font-semibold">Cost</th>
              <th className="pb-3 font-semibold">Margin</th>
              <th className="pb-3 font-semibold">
                <span className="inline-flex items-center gap-1">
                  Units <HelpCircle className="h-3 w-3" />
                </span>
              </th>
              <th className="pb-3 font-semibold">Order cap</th>
              <th className="pb-3 font-semibold">Customer view</th>
              <th className="pb-3 font-semibold">Status</th>
              <th className="pb-3 pr-2 text-right font-semibold">Edit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const out = p.stock <= 0;
              const low = p.stock > 0 && p.stock <= LOW_STOCK;
              const m = marginPct(p.price, p.cost);
              return (
                <tr key={p.id} className="border-b border-ink/5 last:border-0 hover:bg-ink/[0.02]">
                  <td className="py-3 pl-2">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-teal/15 to-gold/15 text-teal">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <span className="font-medium text-ink">{p.name || "Untitled"}</span>
                    </div>
                  </td>
                  <td className="py-3"><CatCell p={p} /></td>
                  <td className="py-3"><NumCell p={p} field="price" prefix="₹" /></td>
                  <td className="py-3"><NumCell p={p} field="cost" prefix="₹" /></td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m >= 40 ? "bg-teal/10 text-teal" : m > 0 ? "bg-gold/15 text-gold" : "bg-sale/10 text-sale"}`}
                    >
                      {m}%
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 ${out ? "text-sale" : low ? "text-gold" : "text-ink"}`}
                    >
                      {(out || low) && <AlertTriangle className="h-3.5 w-3.5" />}
                      <NumCell p={p} field="stock" />
                    </span>
                  </td>
                  <td className="py-3"><NumCell p={p} field="maxPerOrder" placeholder="—" /></td>
                  <td className="py-3">
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-ink-soft">
                      {STOCK_LABEL[p.stockMode]}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.published ? "bg-teal/10 text-teal" : "bg-ink/5 text-ink-soft"}`}
                    >
                      {p.published ? "Live" : "Hidden"}
                    </span>
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <button
                      onClick={() => onOpen(p.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/10"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Open
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center">
                  {loadState === "loading" && <span className="text-ink-soft/70">Loading inventory…</span>}
                  {loadState === "error" && (
                    <span className="text-sale">
                      Couldn&apos;t load the catalogue. This is a connection or sign-in problem, not
                      an empty shop — reload once you&apos;re back online.
                    </span>
                  )}
                  {loadState === "ready" && (
                    <span className="text-ink-soft/70">
                      {products.length === 0
                        ? "No products yet."
                        : `No products match “${search}”.`}
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
