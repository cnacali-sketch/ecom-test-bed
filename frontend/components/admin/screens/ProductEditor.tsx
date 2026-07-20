"use client";

// Full product editor with a live shopper-preview column.
//
// The standalone demo had a 5-frame gold-border picker here. It is GONE: the
// storefront gives every card the same uniform gold hover-ring, so there is no
// per-product frame to choose. Everything else from the demo is preserved —
// publish gate, duplicate-name warning, badge styling, backend-only cost/stock,
// stock-visibility modes, dimensions, and the featured toggle.

import { AlertTriangle, Copy, EyeOff, Info, Percent, RotateCcw, Save, Tag, Zap } from "lucide-react";

import { discount, marginPct, dimStr, rupee, similarity } from "@/lib/admin/helpers";
import {
  BADGE_BG,
  BADGE_FG,
  type AdminCategory,
  type AdminProduct,
} from "@/lib/admin/types";
import type { BadgeAnimation, StockMode } from "@/lib/types";
import { DiscountBadge, Field, HelpTip, ShowToggle, Toggle, inputCls } from "../atoms";
import { ImageDrop } from "../ImageDrop";
import { ProductCardPreview } from "../ProductCardPreview";

const ANIMS: { id: BadgeAnimation; label: string }[] = [
  { id: "shine", label: "Shine" },
  { id: "pulse", label: "Pulse" },
  { id: "wiggle", label: "Wiggle" },
  { id: "none", label: "None" },
];

const MODES: { id: StockMode; label: string; tip: string }[] = [
  { id: "hidden", label: "Hide count", tip: 'Customers just see "In stock". The real number stays private.' },
  { id: "exact", label: "Show exact", tip: 'Customers see "12 in stock". Good for trust.' },
  { id: "lowOnly", label: "Only when low", tip: 'Shows "Only 3 left" to create urgency when stock is low.' },
];

export function ProductEditor({
  draft,
  setDraft,
  onSave,
  onReset,
  dirty,
  products,
  categories,
}: {
  draft: AdminProduct;
  setDraft: (p: AdminProduct) => void;
  onSave: () => void;
  onReset: () => void;
  dirty: boolean;
  products: AdminProduct[];
  categories: AdminCategory[];
}) {
  const set = <K extends keyof AdminProduct>(k: K, v: AdminProduct[K]) => setDraft({ ...draft, [k]: v });
  const setShow = (k: keyof AdminProduct["show"], v: boolean) =>
    setDraft({ ...draft, show: { ...draft.show, [k]: v } });
  const setDim = (k: keyof AdminProduct["dims"], v: string) =>
    setDraft({ ...draft, dims: { ...draft.dims, [k]: v } });
  const setBadge = <K extends keyof AdminProduct["badge"]>(k: K, v: AdminProduct["badge"][K]) =>
    setDraft({ ...draft, badge: { ...draft.badge, [k]: v } });

  const errors: Record<string, string> = {};
  if (!draft.name?.trim()) errors.name = "Required — your reports need a name.";
  if (!draft.category?.trim()) errors.category = "Required for category sales reports.";
  if (!(draft.price > 0)) errors.price = "Enter a selling price above ₹0.";
  if (!(draft.cost > 0)) errors.cost = "Enter your cost per unit for profit reports.";
  if (draft.stock === ("" as unknown) || draft.stock < 0 || isNaN(draft.stock))
    errors.stock = "Enter the real unit count (0 is fine).";
  const hasErrors = Object.keys(errors).length > 0;

  const dupMatches = products
    .filter((p) => p.id !== draft.id)
    .map((p) => ({ p, score: similarity(draft.name, p.name) }))
    .filter((m) => m.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const exactDup = dupMatches.some((m) => m.score >= 0.999);

  const off = discount(draft.mrp, draft.price);
  const margin = marginPct(draft.price, draft.cost);
  const profit = (draft.price || 0) - (draft.cost || 0);
  const autoBadge = off > 0 ? `${off}% OFF` : "";
  const badgePreviewText = (draft.badge.text || "").trim() || autoBadge;
  const catNames = categories.map((c) => c.name);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        {/* publish */}
        <div className={`rounded-2xl border p-5 shadow-sm ${draft.published ? "border-teal/40 bg-teal/5" : "border-ink/10 bg-card"}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-1.5 text-base font-bold text-ink">
                Publish this product{" "}
                <HelpTip text="On = customers can find and buy it. Off = saved privately, only you can see it." />
              </div>
              <p className="mt-0.5 text-sm text-ink-soft">
                {draft.published ? "Live in your shop right now." : "Hidden — a safe place to set things up first."}
              </p>
              {hasErrors && (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-sale">
                  <AlertTriangle className="h-3.5 w-3.5" /> Fill the required fields below before publishing.
                </p>
              )}
            </div>
            <Toggle
              on={draft.published && !hasErrors}
              onChange={(v) => {
                if (v && hasErrors) return;
                set("published", v);
              }}
              label={draft.published ? "On" : "Off"}
            />
          </div>
        </div>

        {/* details */}
        <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-ink">Product details</h2>
              <p className="text-sm text-ink-soft">
                <span className="text-sale">*</span> must be filled for accurate reports.
              </p>
            </div>
            {dirty && (
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-gold" /> Unsaved
              </span>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <Field
                label="Product name"
                required
                error={errors.name}
                help="The title customers read first. Keep it short and clear."
                right={<ShowToggle on={draft.show.name} onChange={(v) => setShow("name", v)} />}
              >
                <input
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Pearl Drop Earrings"
                />
              </Field>
              {draft.name?.trim() && dupMatches.length > 0 && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${exactDup ? "bg-sale/5 text-sale" : "bg-gold/10 text-gold"}`}>
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Copy className="h-3.5 w-3.5" />
                    {exactDup ? "This name already exists" : "Similar product names found"}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {dupMatches.map((m) => (
                      <li key={m.p.id}>
                        • {m.p.name} <span className="opacity-60">({Math.round(m.score * 100)}% alike)</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Field
              label="Category"
              required
              error={errors.category}
              help="Pick existing or type a brand-new one."
              right={<ShowToggle on={draft.show.category} onChange={(v) => setShow("category", v)} />}
            >
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/60" />
                <input
                  list="cat-list-e"
                  className={inputCls + " pl-9"}
                  value={draft.category}
                  onChange={(e) => set("category", e.target.value)}
                  placeholder="Pick or type new…"
                />
                <datalist id="cat-list-e">
                  {catNames.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Selling price" required error={errors.price} help="What the customer actually pays." right={<ShowToggle on={draft.show.price} onChange={(v) => setShow("price", v)} />}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft/60">₹</span>
                  <input type="number" className={inputCls + " pl-7"} value={draft.price} onChange={(e) => set("price", +e.target.value)} />
                </div>
              </Field>
              <Field label="M.R.P." help="Original price. If higher than selling price, a discount appears." right={<ShowToggle on={draft.show.mrp} onChange={(v) => setShow("mrp", v)} />}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft/60">₹</span>
                  <input type="number" className={inputCls + " pl-7"} value={draft.mrp} onChange={(e) => set("mrp", +e.target.value)} />
                </div>
              </Field>
            </div>

            {/* discount badge — full palette + opacity (frame picker intentionally removed) */}
            <div className="rounded-xl border border-gold/30 bg-gold/[0.06] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Zap className="h-4 w-4 fill-current text-gold" /> Discount badge{" "}
                  <HelpTip text="The eye-catching tag on the photo. Turn off, or write your own label." />
                </div>
                <Toggle on={draft.badge.on} onChange={(v) => setBadge("on", v)} label={draft.badge.on ? "On" : "Off"} />
              </div>
              {draft.badge.on && (
                <div className="mt-3 space-y-3">
                  <div>
                    <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-ink-soft">
                      Badge text
                      {draft.badge.text?.trim() && (
                        <button onClick={() => setBadge("text", "")} className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-teal hover:bg-teal/10">
                          Use auto {autoBadge && `(${autoBadge})`}
                        </button>
                      )}
                    </div>
                    <input
                      className={inputCls}
                      value={draft.badge.text}
                      onChange={(e) => setBadge("text", e.target.value)}
                      placeholder={autoBadge ? `Leave blank for auto: ${autoBadge}` : "e.g. NEW · FESTIVE SALE"}
                    />
                  </div>
                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-ink-soft">Attention style</div>
                    <div className="flex flex-wrap gap-2">
                      {ANIMS.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setBadge("anim", a.id)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${draft.badge.anim === a.id ? "border-gold bg-gold text-white" : "border-ink/20 bg-card text-ink-soft hover:border-gold/50"}`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-ink-soft">Background</div>
                      <div className="flex flex-wrap gap-1.5">
                        {BADGE_BG.map((c) => (
                          <button
                            key={c}
                            onClick={() => setBadge("bg", c)}
                            title={c}
                            className={`h-6 w-6 rounded-full transition ${draft.badge.bg === c ? "ring-2 ring-teal ring-offset-1" : "ring-1 ring-ink/20"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-ink-soft">Text colour</div>
                      <div className="flex flex-wrap gap-1.5">
                        {BADGE_FG.map((c) => (
                          <button
                            key={c}
                            onClick={() => setBadge("fg", c)}
                            title={c}
                            className={`h-6 w-6 rounded-full transition ${draft.badge.fg === c ? "ring-2 ring-teal ring-offset-1" : "ring-1 ring-ink/20"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ink-soft">
                      <span className="flex items-center gap-1">
                        Background opacity <HelpTip text="Lower it to let the photo show through the badge." />
                      </span>
                      <span className="text-ink-soft/60">{draft.badge.opacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={100}
                      step={5}
                      value={draft.badge.opacity}
                      onChange={(e) => setBadge("opacity", +e.target.value)}
                      className="w-full accent-teal"
                    />
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-card/70 px-3 py-2">
                    <span className="text-xs text-ink-soft">Preview:</span>
                    {badgePreviewText ? (
                      <DiscountBadge text={badgePreviewText} anim={draft.badge.anim} bg={draft.badge.bg} fg={draft.badge.fg} opacity={draft.badge.opacity} />
                    ) : (
                      <span className="text-xs italic text-ink-soft/60">Add a discount or type a label to show a badge.</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* backend-only box */}
            <div className="rounded-xl border border-ink/10 bg-ink/[0.02] p-4">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft/60">
                <EyeOff className="h-3.5 w-3.5" /> Backend only — never shown to customers
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Cost / unit" required error={errors.cost} help="What you pay per piece. Powers profit reports.">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft/60">₹</span>
                    <input type="number" className={inputCls + " bg-card pl-7"} value={draft.cost} onChange={(e) => set("cost", +e.target.value)} />
                  </div>
                </Field>
                <Field label="Units in stock" required error={errors.stock} help="Real inventory. Kept for reorder & reports.">
                  <input
                    type="number"
                    className={inputCls + " bg-card"}
                    value={draft.stock}
                    onChange={(e) => set("stock", (e.target.value === "" ? 0 : +e.target.value) as AdminProduct["stock"])}
                  />
                </Field>
                <Field label="Max per order" help="Retail cap per order. Blank = no limit.">
                  <input
                    type="number"
                    min={1}
                    className={inputCls + " bg-card"}
                    value={draft.maxPerOrder}
                    onChange={(e) => set("maxPerOrder", e.target.value === "" ? "" : +e.target.value)}
                    placeholder="No limit"
                  />
                </Field>
              </div>
              {draft.cost > 0 && draft.price > 0 && (
                <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${profit > 0 ? "bg-teal/10 text-teal" : "bg-sale/5 text-sale"}`}>
                  <Percent className="h-4 w-4" />
                  {profit > 0 ? (
                    <>You earn <b className="mx-1">{rupee(profit)}</b> per unit — a <b className="mx-1">{margin}%</b> margin.</>
                  ) : (
                    <>Cost above selling price — you&apos;d lose {rupee(Math.abs(profit))} per unit.</>
                  )}
                </div>
              )}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                  What customers see about stock{" "}
                  <HelpTip text="A sales lever: hide, show for trust, or reveal only when low for urgency." />
                </div>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => set("stockMode", m.id)}
                      className={`group relative rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${draft.stockMode === m.id ? "border-teal bg-teal text-white" : "border-ink/20 bg-card text-ink-soft hover:border-teal/50"}`}
                    >
                      {m.label}
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-48 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-[11px] font-normal leading-relaxed text-white opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                        {m.tip}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <ImageDrop value={draft.image} onChange={(v) => set("image", v)} />

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                Product size <span className="text-xs font-normal text-ink-soft/60">(optional)</span>
                <HelpTip text="Add Height × Width, and Length too if it matters." />
                <span className="ml-auto"><ShowToggle on={draft.show.dims} onChange={(v) => setShow("dims", v)} /></span>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="H" className={inputCls + " text-center"} value={draft.dims.h} onChange={(e) => setDim("h", e.target.value)} />
                <span className="text-ink-soft/60">×</span>
                <input type="number" placeholder="W" className={inputCls + " text-center"} value={draft.dims.w} onChange={(e) => setDim("w", e.target.value)} />
                <span className="text-ink-soft/60">×</span>
                <input type="number" placeholder="L (opt)" className={inputCls + " text-center"} value={draft.dims.l} onChange={(e) => setDim("l", e.target.value)} />
                <select className={inputCls + " w-24"} value={draft.dims.unit} onChange={(e) => setDim("unit", e.target.value as AdminProduct["dims"]["unit"])}>
                  <option value="cm">cm</option>
                  <option value="in">in</option>
                  <option value="mm">mm</option>
                </select>
              </div>
              {dimStr(draft.dims) && <p className="mt-1 text-xs text-ink-soft/70">Shows on shop as “Size: {dimStr(draft.dims)}”.</p>}
            </div>

            <Field label="Description" help="A line or two on material, size, or care.">
              <textarea rows={3} className={inputCls} value={draft.desc} onChange={(e) => set("desc", e.target.value)} placeholder="What makes this piece special?" />
            </Field>

            <Field label="Featured on homepage" help="Show in the Featured section on the homepage.">
              <Toggle on={draft.featured} onChange={(v) => set("featured", v)} label={draft.featured ? "Yes" : "No"} />
            </Field>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-ink/10 pt-5">
            <button
              onClick={onSave}
              disabled={!dirty || hasErrors}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${dirty && !hasErrors ? "bg-teal hover:bg-teal-deep" : "cursor-not-allowed bg-ink/30"}`}
            >
              <Save className="h-4 w-4" /> Save changes
            </button>
            <button
              onClick={onReset}
              disabled={!dirty}
              className="flex items-center gap-2 rounded-xl border border-ink/20 px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:bg-ink/5 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" /> Undo
            </button>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-soft/60">
              <Info className="h-3.5 w-3.5" /> Nothing goes live until you Save
            </span>
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white">
          Live preview — what customers see
        </div>
        <ProductCardPreview p={draft} />
        <p className="mt-3 text-center text-xs text-ink-soft/60">Cost, stock count & margin stay backend-only.</p>
      </div>
    </div>
  );
}
