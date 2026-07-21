import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  LayoutGrid, Package, Boxes, Search, Save, RotateCcw, Eye, HelpCircle,
  AlertTriangle, ImageIcon, Star, ShoppingBag, Pencil, Sparkles, TrendingUp,
  CircleCheck, Info, UploadCloud, Trash2, EyeOff, CheckCircle2, Ruler, Copy,
  Percent, Tag, Zap, Minus, Plus, Frame
} from "lucide-react";

/* ------------------------------------------------------------------ *
 *  Savvy In Teal — Store Manager (retail)                             *
 * ------------------------------------------------------------------ */

const BASE_CATEGORIES = ["Hair Clips", "Scrunchies", "Earrings", "Necklaces", "Bracelets", "Hair Bands"];
const REQ_IMG = { w: 1000, h: 1000, maxMB: 2 };
const LOW_STOCK = 5;
const GOLD_GRAD = "linear-gradient(135deg,#bf953f 0%,#fcf6ba 22%,#b38728 45%,#fbf5b7 70%,#aa771c 100%)";

const rupee = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const discount = (mrp, price) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB");
const marginPct = (price, cost) => (price > 0 ? Math.round(((price - cost) / price) * 100) : 0);

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
function similarity(a, b) {
  const na = norm(a), nb = norm(b); if (!na || !nb) return 0; if (na === nb) return 1;
  const r = 1 - lev(na, nb) / Math.max(na.length, nb.length);
  const A = new Set(na.split(" ")), B = new Set(nb.split(" "));
  const j = [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
  const contains = na.includes(nb) || nb.includes(na) ? 0.85 : 0;
  return Math.max(r, j, contains);
}
function dimStr(d) { if (!d) return ""; const { h, w, l, unit } = d; if (!(h && w)) return ""; return (l ? `${h} × ${w} × ${l}` : `${h} × ${w}`) + ` ${unit || "cm"}`; }
function hexToRgba(hex, a) { const h = (hex || "#000").replace("#", ""); const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h; const n = parseInt(f, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
const BADGE_BG = ["#f59e0b", "#b8860b", "#0d9488", "#e11d48", "#b91c1c", "#7c3aed", "#059669", "#1f2937", "#ffffff"];
const BADGE_FG = ["#ffffff", "#111827", "#b8860b", "#0d9488", "#fffbeb"];

/* ---- 5 gold frame styles for the whole product card ---- */
const FRAMES = [
  { id: "fine", label: "Fine line" },
  { id: "gilded", label: "Gilded" },
  { id: "double", label: "Twin line" },
  { id: "ornate", label: "Framed" },
  { id: "shimmer", label: "Shimmer" },
];
function goldBorder(id) {
  switch (id) {
    case "fine": return { card: { border: "2px solid #c9a227", boxShadow: "0 4px 14px rgba(191,149,63,.18)" } };
    case "double": return { card: { border: "4px double #b8860b", boxShadow: "0 4px 14px rgba(191,149,63,.18)" } };
    case "ornate": return { card: { border: "2px solid #bf953f", boxShadow: "inset 0 0 0 3px #fff, inset 0 0 0 4px #e6c25a, 0 6px 18px rgba(191,149,63,.28)" } };
    case "gilded": return { wrap: { background: GOLD_GRAD, padding: "3px", borderRadius: "19px", boxShadow: "0 6px 18px rgba(191,149,63,.28)" }, card: { borderRadius: "16px" } };
    case "shimmer": return { wrap: { padding: "3px", borderRadius: "19px" }, wrapClass: "gold-shimmer", card: { borderRadius: "16px" } };
    default: return { card: {} };
  }
}
function FrameSwatch({ id }) {
  const b = goldBorder(id);
  const inner = <div className="h-full w-full bg-white" style={{ borderRadius: b.card.borderRadius || "9px", ...b.card }} />;
  return b.wrap
    ? <div className={`h-14 w-14 ${b.wrapClass || ""}`} style={{ ...b.wrap, borderRadius: "11px" }}>{inner}</div>
    : <div className="h-14 w-14">{inner}</div>;
}

const defShow = () => ({ name: true, category: true, price: true, mrp: true, dims: true });
const defBadge = (anim = "shine", text = "", bg = "#f59e0b", fg = "#ffffff", opacity = 100) => ({ on: true, text, anim, bg, fg, opacity });
const SEED = [
  { id: 1, name: "Teal Velvet Scrunchie Set", category: "Scrunchies", price: 249, mrp: 399, cost: 90, stock: 42, maxPerOrder: "", desc: "Soft velvet scrunchies in three shades of teal. Gentle on hair, no crease.", image: "", published: true, show: defShow(), stockMode: "hidden", dims: { h: "", w: "", l: "", unit: "cm" }, badge: defBadge("shine"), borderStyle: "gilded" },
  { id: 2, name: "Pearl Drop Earrings", category: "Earrings", price: 599, mrp: 899, cost: 240, stock: 4, maxPerOrder: 3, desc: "Freshwater-style pearl drops on gold-tone hooks. Lightweight all day.", image: "", published: true, show: defShow(), stockMode: "lowOnly", dims: { h: "3.5", w: "1", l: "", unit: "cm" }, badge: defBadge("pulse"), borderStyle: "shimmer" },
  { id: 3, name: "Butterfly Hair Claw", category: "Hair Clips", price: 179, mrp: 249, cost: 70, stock: 0, maxPerOrder: "", desc: "Strong-grip acrylic claw clip with a marble finish.", image: "", published: false, show: defShow(), stockMode: "hidden", dims: { h: "", w: "", l: "", unit: "cm" }, badge: defBadge("shine"), borderStyle: "fine" },
  { id: 4, name: "Kundan Choker", category: "Necklaces", price: 1299, mrp: 1899, cost: 520, stock: 11, maxPerOrder: 2, desc: "Traditional kundan-style choker with an adjustable back tie.", image: "", published: true, show: { name: true, category: true, price: true, mrp: false, dims: true }, stockMode: "exact", dims: { h: "1", w: "38", l: "", unit: "cm" }, badge: defBadge("shine"), borderStyle: "ornate" },
  { id: 5, name: "Beaded Charm Bracelet", category: "Bracelets", price: 349, mrp: 499, cost: 130, stock: 3, maxPerOrder: "", desc: "Hand-strung glass beads with a small evil-eye charm.", image: "", published: true, show: defShow(), stockMode: "lowOnly", dims: { h: "", w: "", l: "", unit: "cm" }, badge: defBadge("wiggle", "FESTIVE SALE", "#b91c1c", "#ffffff", 100), borderStyle: "double" },
];

function HelpTip({ text }) {
  return (
    <span className="relative inline-flex group align-middle"><HelpCircle className="w-3.5 h-3.5 text-stone-400 hover:text-teal-600 cursor-help transition-colors" /><span className="pointer-events-none absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-lg bg-stone-800 px-3 py-2 text-xs leading-relaxed text-stone-100 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">{text}</span></span>
  );
}
function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex items-center gap-1.5 text-xs font-semibold"><span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-teal-600" : "bg-stone-300"}`}><span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} /></span>{label && <span className={on ? "text-stone-600" : "text-stone-400"}>{label}</span>}</button>
  );
}
const ShowToggle = ({ on, onChange }) => (<span className="ml-auto flex items-center gap-1 text-stone-400">{on ? <Eye className="h-3.5 w-3.5 text-teal-500" /> : <EyeOff className="h-3.5 w-3.5" />}<Toggle on={on} onChange={onChange} label={on ? "Shown" : "Hidden"} /></span>);
function Field({ label, help, required, right, error, children }) {
  return (
    <label className="block"><span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">{label}{required && <span className="text-rose-500">*</span>}{help && <HelpTip text={help} />}{right && <span className="ml-auto flex items-center">{right}</span>}</span>{children}{error && <span className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600"><AlertTriangle className="h-3 w-3" />{error}</span>}</label>
  );
}
const inputCls = "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

function DiscountBadge({ text, anim, bg = "#f59e0b", fg = "#ffffff", opacity = 100, className = "" }) {
  const a = anim === "pulse" ? "badge-pulse" : anim === "wiggle" ? "badge-wiggle" : anim === "shine" ? "badge-shine" : "";
  return (<span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow ${a} ${className}`} style={{ backgroundColor: hexToRgba(bg, (opacity ?? 100) / 100), color: fg }}><Zap className="h-3 w-3 fill-current" /> {text}</span>);
}

/* -------------------------- Live preview --------------------------- */
function LivePreview({ p }) {
  const off = discount(p.mrp, p.price);
  const out = p.stock <= 0;
  const low = p.stock > 0 && p.stock <= LOW_STOCK;
  const size = dimStr(p.dims);
  const badgeText = (p.badge.text || "").trim() || (off > 0 ? `${off}% OFF` : "");
  const showBadge = p.badge.on && p.show.price && badgeText;
  const b = goldBorder(p.borderStyle);

  const mpo = Number(p.maxPerOrder) > 0 ? Number(p.maxPerOrder) : Infinity;
  const cap = Math.max(1, Math.min(p.stock, mpo));
  const [qty, setQty] = useState(1);
  useEffect(() => { setQty((q) => Math.min(Math.max(1, q), cap)); }, [cap]);
  const [ctaActive, setCtaActive] = useState(false);
  const [cardActive, setCardActive] = useState(false);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const atOrderLimit = mpo !== Infinity && qty >= mpo && mpo <= p.stock;
  const atStock = qty >= p.stock && !atOrderLimit;

  let stockNode;
  if (out) stockNode = <span className="text-xs font-semibold text-rose-600">Out of stock</span>;
  else if (p.stockMode === "exact") stockNode = <span className="text-xs font-semibold text-emerald-600">{p.stock} in stock</span>;
  else if (p.stockMode === "lowOnly") stockNode = low ? <span className="text-xs font-semibold text-amber-600">Only {p.stock} left — selling fast</span> : <span className="text-xs font-semibold text-emerald-600">In stock</span>;
  else stockNode = <span className="text-xs font-semibold text-emerald-600">In stock</span>;

  const card = (
    <div className="relative w-full overflow-hidden bg-white shadow-sm" style={{ borderRadius: b.card.borderRadius || "16px", ...b.card }}>
      {!p.published && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/75 backdrop-blur-[1px]"><EyeOff className="mb-1.5 h-6 w-6 text-stone-500" /><span className="text-sm font-bold text-stone-700">Not published</span><span className="px-6 text-center text-xs text-stone-500">Customers can’t see this yet. Flip “Publish” on when ready.</span></div>
      )}
      <div className="relative aspect-square w-full bg-gradient-to-br from-teal-50 to-amber-50">
        {p.image ? <img src={p.image} alt="" className="h-full w-full object-cover" /> : (<div className="flex h-full w-full flex-col items-center justify-center text-teal-300"><ImageIcon className="mb-2 h-10 w-10" strokeWidth={1.5} /><span className="text-xs text-teal-400">Add a photo to shine</span></div>)}
        {showBadge && <div className="absolute left-3 top-3"><DiscountBadge text={badgeText} anim={p.badge.anim} bg={p.badge.bg} fg={p.badge.fg} opacity={p.badge.opacity} /></div>}
      </div>
      <div className="p-4">
        {p.show.category && <span className="text-[11px] font-semibold uppercase tracking-wide text-teal-600">{p.category}</span>}
        <h3 className="mt-1 font-semibold leading-snug text-stone-800" style={{ fontFamily: "'Fraunces', serif" }}>{p.show.name ? (p.name || "Untitled product") : "New arrival"}</h3>
        <div className="mt-2 flex items-center gap-1 text-amber-500">{[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}<span className="ml-1 text-xs text-stone-400">(new)</span></div>
        {p.show.price ? (<div className="mt-3 flex items-baseline gap-2"><span className="text-xl font-bold text-stone-900">{rupee(p.price)}</span>{p.show.mrp && off > 0 && <span className="text-sm text-stone-400 line-through">{rupee(p.mrp)}</span>}</div>) : <div className="mt-3 text-sm font-semibold text-teal-700">Price on request</div>}
        {p.desc && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-500">{p.desc}</p>}
        {p.show.dims && size && <p className="mt-2 flex items-center gap-1 text-xs text-stone-500"><Ruler className="h-3.5 w-3.5 text-stone-400" /> Size: {size}</p>}
        <div className="mt-3">{stockNode}</div>
        {!out && (
          <>
            <div className="mt-3 flex items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-stone-300">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="px-2 py-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
                <span className="w-8 text-center text-sm font-semibold text-stone-800">{qty}</span>
                <button onClick={() => setQty((q) => Math.min(cap, q + 1))} disabled={qty >= cap} className="px-2 py-1.5 text-stone-500 hover:bg-stone-100 disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
              </div>
              <span className="text-xs text-stone-400">Quantity</span>
            </div>
            {atOrderLimit && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-600"><Info className="h-3.5 w-3.5" /> Maximum {p.maxPerOrder} per order</p>}
            {atStock && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-600"><Info className="h-3.5 w-3.5" /> Only {p.stock} available</p>}
          </>
        )}
        <button disabled={out}
          onMouseEnter={() => setCtaActive(true)} onMouseLeave={() => setCtaActive(false)}
          onTouchStart={() => setCtaActive(true)} onTouchEnd={() => setCtaActive(false)} onTouchCancel={() => setCtaActive(false)}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors ${out ? "cursor-not-allowed border-2 border-stone-300 bg-stone-200 text-stone-400" : `teal-cta ${ctaActive ? "is-gold" : ""}`}`}>
          <ShoppingBag className="h-4 w-4" /> {out ? "Sold out" : "Add to cart"}
        </button>
      </div>
    </div>
  );

  const framed = b.wrap ? <div className={`w-full ${b.wrapClass || ""}`} style={b.wrap}>{card}</div> : card;
  const reactStyle = cardActive
    ? { boxShadow: "0 16px 34px rgba(191,149,63,.38)", ...(reduceMotion ? {} : { transform: "translateY(-5px)", filter: "brightness(1.04)" }) }
    : {};
  return (
    <div className="card-react mx-auto w-full max-w-xs" style={{ borderRadius: "18px", ...reactStyle }}
      onMouseEnter={() => setCardActive(true)} onMouseLeave={() => setCardActive(false)}
      onTouchStart={() => setCardActive(true)} onTouchEnd={() => setCardActive(false)} onTouchCancel={() => setCardActive(false)}>
      {framed}
    </div>
  );
}

/* --------------------------- Image drop ---------------------------- */
function ImageDrop({ value, onChange }) {
  const [drag, setDrag] = useState(false); const [err, setErr] = useState(""); const [meta, setMeta] = useState(null); const inputRef = useRef(null);
  const handle = (fileList) => {
    setErr(""); const file = fileList && fileList[0]; if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("That file isn’t an image. Please choose a JPG or PNG."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target.result; const img = new Image();
      img.onload = () => {
        if (img.naturalWidth !== REQ_IMG.w || img.naturalHeight !== REQ_IMG.h) { setErr(`Your photo is ${img.naturalWidth} × ${img.naturalHeight} px. It must be exactly ${REQ_IMG.w} × ${REQ_IMG.h} px, so nothing was uploaded. Please resize and try again.`); return; }
        if (file.size > REQ_IMG.maxMB * 1048576) { setErr(`This photo is ${fmtSize(file.size)}. Keep it under ${REQ_IMG.maxMB} MB — nothing was uploaded.`); return; }
        setMeta({ name: file.name, size: file.size, w: img.naturalWidth, h: img.naturalHeight }); onChange(url);
      }; img.src = url;
    }; reader.readAsDataURL(file);
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">Product photo <HelpTip text="Every photo must be the same shape so your shop grid stays neat. Only the exact size below is accepted." /><span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-500">Square · exactly {REQ_IMG.w}×{REQ_IMG.h} px · up to {REQ_IMG.maxMB} MB</span></div>
      {value ? (
        <div className="flex items-center gap-4 rounded-xl border border-stone-200 bg-stone-50 p-3"><img src={value} alt="" className="h-20 w-20 rounded-lg object-cover" /><div className="min-w-0 flex-1"><div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Photo accepted</div>{meta && <div className="mt-0.5 truncate text-xs text-stone-500">{meta.name} · {meta.w}×{meta.h} · {fmtSize(meta.size)}</div>}<button onClick={() => { onChange(""); setMeta(null); setErr(""); }} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"><Trash2 className="h-3.5 w-3.5" /> Remove</button></div></div>
      ) : (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }} onClick={() => inputRef.current?.click()} className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? "border-teal-500 bg-teal-50" : "border-stone-300 bg-white hover:border-teal-400 hover:bg-stone-50"}`}><UploadCloud className={`mb-2 h-8 w-8 ${drag ? "text-teal-600" : "text-stone-400"}`} /><div className="text-sm font-semibold text-stone-700">Drag a photo here, or click to choose</div><div className="mt-0.5 text-xs text-stone-400">Photos that aren’t {REQ_IMG.w}×{REQ_IMG.h} px are rejected automatically</div><input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handle(e.target.files)} /></div>
      )}
      {err && <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}</div>}
    </div>
  );
}

/* --------------------------- Product editor ------------------------ */
function Editor({ draft, setDraft, onSave, onReset, dirty, products, categories }) {
  const set = (k, v) => setDraft({ ...draft, [k]: v });
  const setShow = (k, v) => setDraft({ ...draft, show: { ...draft.show, [k]: v } });
  const setDim = (k, v) => setDraft({ ...draft, dims: { ...draft.dims, [k]: v } });
  const setBadge = (k, v) => setDraft({ ...draft, badge: { ...draft.badge, [k]: v } });

  const errors = {};
  if (!draft.name.trim()) errors.name = "Required — your reports need a name.";
  if (!draft.category.trim()) errors.category = "Required for category sales reports.";
  if (!(draft.price > 0)) errors.price = "Enter a selling price above ₹0.";
  if (!(draft.cost > 0)) errors.cost = "Enter your cost per unit for profit reports.";
  if (draft.stock === "" || draft.stock < 0 || isNaN(draft.stock)) errors.stock = "Enter the real unit count (0 is fine).";
  const hasErrors = Object.keys(errors).length > 0;

  const dupMatches = products.filter((p) => p.id !== draft.id).map((p) => ({ p, score: similarity(draft.name, p.name) })).filter((m) => m.score >= 0.6).sort((a, b) => b.score - a.score).slice(0, 3);
  const exactDup = dupMatches.some((m) => m.score >= 0.999);

  const off = discount(draft.mrp, draft.price);
  const margin = marginPct(draft.price, draft.cost);
  const profit = (draft.price || 0) - (draft.cost || 0);
  const autoBadge = off > 0 ? `${off}% OFF` : "";
  const badgePreviewText = (draft.badge.text || "").trim() || autoBadge;
  const modes = [
    { id: "hidden", label: "Hide count", tip: "Customers just see “In stock”. The real number stays private." },
    { id: "exact", label: "Show exact", tip: "Customers see “12 in stock”. Good for trust." },
    { id: "lowOnly", label: "Only when low", tip: "Shows “Only 3 left” to create urgency when stock is low." },
  ];
  const anims = [{ id: "shine", label: "Shine" }, { id: "pulse", label: "Pulse" }, { id: "wiggle", label: "Wiggle" }, { id: "none", label: "None" }];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className={`rounded-2xl border p-5 shadow-sm ${draft.published ? "border-teal-200 bg-teal-50" : "border-stone-200 bg-white"}`}>
          <div className="flex items-center justify-between gap-4">
            <div><div className="flex items-center gap-1.5 text-base font-bold text-stone-800">Publish this product <HelpTip text="On = customers can find and buy it. Off = saved privately, only you can see it." /></div><p className="mt-0.5 text-sm text-stone-500">{draft.published ? "Live in your shop right now." : "Hidden — a safe place to set things up first."}</p>{hasErrors && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> Fill the required fields below before publishing.</p>}</div>
            <Toggle on={draft.published && !hasErrors} onChange={(v) => { if (v && hasErrors) return; set("published", v); }} label={draft.published ? "On" : "Off"} />
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-stone-800">Product details</h2><p className="text-sm text-stone-500"><span className="text-rose-500">*</span> must be filled for accurate reports — the <span className="mx-1 inline-flex items-center gap-1 align-middle"><Eye className="h-3.5 w-3.5 text-teal-500" />Shown</span> switch only controls what customers see.</p></div>{dirty && <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved</span>}</div>

          <div className="space-y-5">
            <div>
              <Field label="Product name" required error={errors.name} help="The title customers read first. Keep it short and clear." right={<ShowToggle on={draft.show.name} onChange={(v) => setShow("name", v)} />}><input className={inputCls} value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pearl Drop Earrings" /></Field>
              {draft.name.trim() && dupMatches.length > 0 && (
                <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${exactDup ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}><div className="flex items-center gap-1.5 font-semibold"><Copy className="h-3.5 w-3.5" />{exactDup ? "This name already exists" : "Similar product names found"}</div><ul className="mt-1 space-y-0.5">{dupMatches.map((m) => <li key={m.p.id}>• {m.p.name} <span className="opacity-60">({Math.round(m.score * 100)}% alike)</span></li>)}</ul><p className="mt-1 opacity-70">Rename it to avoid duplicates, or keep it if this is a genuine variant.</p></div>
              )}
            </div>

            <Field label="Category" required error={errors.category} help="Pick an existing shelf or type a brand-new one — new categories are saved automatically." right={<ShowToggle on={draft.show.category} onChange={(v) => setShow("category", v)} />}>
              <div className="relative"><Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input list="cat-list" className={inputCls + " pl-9"} value={draft.category} onChange={(e) => set("category", e.target.value)} placeholder="Pick one or type a new category…" /><datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Selling price" required error={errors.price} help="What the customer actually pays." right={<ShowToggle on={draft.show.price} onChange={(v) => setShow("price", v)} />}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">₹</span><input type="number" className={inputCls + " pl-7"} value={draft.price} onChange={(e) => set("price", +e.target.value)} /></div></Field>
              <Field label="M.R.P." help="Original price. Optional — if higher than the selling price, a discount appears." right={<ShowToggle on={draft.show.mrp} onChange={(v) => setShow("mrp", v)} />}><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">₹</span><input type="number" className={inputCls + " pl-7"} value={draft.mrp} onChange={(e) => set("mrp", +e.target.value)} /></div></Field>
            </div>

            {/* gold frame picker */}
            <div className="rounded-xl border p-4" style={{ borderColor: "#e6c25a", background: "linear-gradient(135deg,#fffdf5,#fbf3d9)" }}>
              <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Frame className="h-4 w-4" style={{ color: "#b8860b" }} /> Card frame — gold border <HelpTip text="A rich gold frame around the whole product card. Pick one of five looks; it shows instantly in the preview." /></div>
              <div className="grid grid-cols-5 gap-2">
                {FRAMES.map((f) => (
                  <button key={f.id} onClick={() => set("borderStyle", f.id)} className={`flex flex-col items-center gap-1.5 rounded-xl p-2 transition ${draft.borderStyle === f.id ? "bg-white shadow-sm ring-2 ring-amber-500" : "hover:bg-white/60"}`}>
                    <FrameSwatch id={f.id} />
                    <span className={`text-[11px] font-semibold ${draft.borderStyle === f.id ? "text-amber-700" : "text-stone-500"}`}>{f.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* discount badge control */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-sm font-semibold text-stone-700"><Zap className="h-4 w-4 text-amber-500 fill-current" /> Discount badge <HelpTip text="The eye-catching tag on the photo. Turn it off, or write your own label like ‘FESTIVE SALE’." /></div><Toggle on={draft.badge.on} onChange={(v) => setBadge("on", v)} label={draft.badge.on ? "On" : "Off"} /></div>
              {draft.badge.on && (
                <div className="mt-3 space-y-3">
                  <div><div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-stone-600">Badge text{draft.badge.text.trim() && <button onClick={() => setBadge("text", "")} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-50">Use auto {autoBadge && `(${autoBadge})`}</button>}</div><input className={inputCls} value={draft.badge.text} onChange={(e) => setBadge("text", e.target.value)} placeholder={autoBadge ? `Leave blank for auto: ${autoBadge}` : "e.g. NEW · FESTIVE SALE · LIMITED"} /></div>
                  <div><div className="mb-1.5 text-xs font-semibold text-stone-600">Attention style</div><div className="flex flex-wrap gap-2">{anims.map((a) => (<button key={a.id} onClick={() => setBadge("anim", a.id)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${draft.badge.anim === a.id ? "border-amber-500 bg-amber-500 text-white" : "border-stone-300 bg-white text-stone-600 hover:border-amber-300"}`}>{a.label}</button>))}</div></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-stone-600">Background</div>
                      <div className="flex flex-wrap gap-1.5">{BADGE_BG.map((c) => (<button key={c} onClick={() => setBadge("bg", c)} title={c} className={`h-6 w-6 rounded-full transition ${draft.badge.bg === c ? "ring-2 ring-teal-500 ring-offset-1" : "ring-1 ring-stone-300"}`} style={{ backgroundColor: c }} />))}</div>
                    </div>
                    <div>
                      <div className="mb-1.5 text-xs font-semibold text-stone-600">Text colour</div>
                      <div className="flex flex-wrap gap-1.5">{BADGE_FG.map((c) => (<button key={c} onClick={() => setBadge("fg", c)} title={c} className={`h-6 w-6 rounded-full transition ${draft.badge.fg === c ? "ring-2 ring-teal-500 ring-offset-1" : "ring-1 ring-stone-300"}`} style={{ backgroundColor: c }} />))}</div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-stone-600"><span className="flex items-center gap-1">Background opacity <HelpTip text="Lower it to let the photo show through the badge — handy for a subtle, on-trend look." /></span><span className="text-stone-400">{draft.badge.opacity}%</span></div>
                    <input type="range" min="30" max="100" step="5" value={draft.badge.opacity} onChange={(e) => setBadge("opacity", +e.target.value)} className="w-full accent-teal-600" />
                  </div>
                  <div className="flex items-center gap-3 rounded-lg bg-white/70 px-3 py-2"><span className="text-xs text-stone-500">Preview:</span>{badgePreviewText ? <DiscountBadge text={badgePreviewText} anim={draft.badge.anim} bg={draft.badge.bg} fg={draft.badge.fg} opacity={draft.badge.opacity} /> : <span className="text-xs italic text-stone-400">Add a discount (MRP above price) or type a label to show a badge.</span>}</div>
                </div>
              )}
            </div>

            {/* backend-only box */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
              <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-stone-400"><EyeOff className="h-3.5 w-3.5" /> Backend only — never shown to customers</div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Cost / unit" required error={errors.cost} help="What you pay per piece. Used to work out profit — customers never see it."><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">₹</span><input type="number" className={inputCls + " bg-white pl-7"} value={draft.cost} onChange={(e) => set("cost", +e.target.value)} /></div></Field>
                <Field label="Units in stock" required error={errors.stock} help="Your true inventory count, kept for reordering & reports."><input type="number" className={inputCls + " bg-white"} value={draft.stock} onChange={(e) => set("stock", e.target.value === "" ? "" : +e.target.value)} /></Field>
                <Field label="Max per order" help="Retail cap on how many one customer can buy in a single order. Leave blank for no limit. Customers only see it if they try to exceed it."><input type="number" min="1" className={inputCls + " bg-white"} value={draft.maxPerOrder} onChange={(e) => set("maxPerOrder", e.target.value === "" ? "" : +e.target.value)} placeholder="No limit" /></Field>
              </div>
              {draft.cost > 0 && draft.price > 0 && (<div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${profit > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}><Percent className="h-4 w-4" />{profit > 0 ? <>You earn <b className="mx-1">{rupee(profit)}</b> per unit — a <b className="mx-1">{margin}%</b> margin.</> : <>Your cost is above your selling price — you’d lose {rupee(Math.abs(profit))} per unit.</>}</div>)}
              {Number(draft.maxPerOrder) > 0 && (<p className="mt-2 flex items-center gap-1 text-xs text-stone-500"><Info className="h-3.5 w-3.5" /> Shoppers can add up to {draft.maxPerOrder} per order; the limit stays hidden until they reach it.</p>)}
              <div className="mt-4"><div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">What customers see about stock <HelpTip text="A sales lever: hide the number, show it for trust, or reveal only when low for urgency." /></div><div className="flex flex-wrap gap-2">{modes.map((m) => (<button key={m.id} onClick={() => set("stockMode", m.id)} className={`group relative rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${draft.stockMode === m.id ? "border-teal-500 bg-teal-600 text-white" : "border-stone-300 bg-white text-stone-600 hover:border-teal-300"}`}>{m.label}<span className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-48 -translate-x-1/2 rounded-lg bg-stone-800 px-3 py-2 text-[11px] font-normal leading-relaxed text-stone-100 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">{m.tip}</span></button>))}</div></div>
            </div>

            <ImageDrop value={draft.image} onChange={(v) => set("image", v)} />

            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700">Product size <span className="text-xs font-normal text-stone-400">(optional)</span><HelpTip text="Add Height × Width, and Length too if it matters. Leave blank if size isn’t relevant." /><span className="ml-auto"><ShowToggle on={draft.show.dims} onChange={(v) => setShow("dims", v)} /></span></div>
              <div className="flex items-center gap-2"><input type="number" placeholder="H" className={inputCls + " text-center"} value={draft.dims.h} onChange={(e) => setDim("h", e.target.value)} /><span className="text-stone-400">×</span><input type="number" placeholder="W" className={inputCls + " text-center"} value={draft.dims.w} onChange={(e) => setDim("w", e.target.value)} /><span className="text-stone-400">×</span><input type="number" placeholder="L (optional)" className={inputCls + " text-center"} value={draft.dims.l} onChange={(e) => setDim("l", e.target.value)} /><select className={inputCls + " w-24"} value={draft.dims.unit} onChange={(e) => setDim("unit", e.target.value)}><option value="cm">cm</option><option value="in">in</option><option value="mm">mm</option></select></div>
              {dimStr(draft.dims) && <p className="mt-1 text-xs text-stone-400">Shows on the shop as “Size: {dimStr(draft.dims)}”.</p>}
            </div>

            <Field label="Description" help="A line or two on material, size, or care — it builds trust."><textarea rows={3} className={inputCls} value={draft.desc} onChange={(e) => set("desc", e.target.value)} placeholder="What makes this piece special?" /></Field>
          </div>

          <div className="mt-6 flex items-center gap-3 border-t border-stone-100 pt-5"><button onClick={onSave} disabled={!dirty || hasErrors} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${dirty && !hasErrors ? "bg-teal-600 hover:bg-teal-700 shadow-sm" : "cursor-not-allowed bg-stone-300"}`}><Save className="h-4 w-4" /> Save changes</button><button onClick={onReset} disabled={!dirty} className="flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-40"><RotateCcw className="h-4 w-4" /> Undo</button><span className="ml-auto flex items-center gap-1.5 text-xs text-stone-400"><Info className="h-3.5 w-3.5" /> Nothing goes live until you Save</span></div>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white"><Eye className="h-4 w-4" /> Live preview — what customers see</div>
        <LivePreview p={draft} />
        <p className="mt-3 text-center text-xs text-stone-400">Hover or tap the card — the frame lifts and the button reveals its gold.</p>
      </div>
    </div>
  );
}

/* ------------------------- Inventory table ------------------------- */
function Inventory({ products, setProducts, onOpen, categories }) {
  const [search, setSearch] = useState(""); const [cat, setCat] = useState("All"); const [edit, setEdit] = useState(null);
  const rows = useMemo(() => { const q = search.trim().toLowerCase(); return products.filter((p) => (cat === "All" || p.category === cat) && (q === "" || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))); }, [products, search, cat]);
  const patch = (id, field, val) => setProducts(products.map((p) => (p.id === id ? { ...p, [field]: val } : p)));
  const stockLabel = { hidden: "Count hidden", exact: "Exact shown", lowOnly: "Shows when low" };
  const NumCell = ({ p, field, prefix = "", placeholder = "" }) => {
    const active = edit && edit.id === p.id && edit.field === field;
    return active ? (<input autoFocus type="number" defaultValue={p[field]} onBlur={(e) => { patch(p.id, field, e.target.value === "" ? "" : +e.target.value); setEdit(null); }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className="w-20 rounded-md border border-teal-400 px-2 py-1 text-sm outline-none ring-2 ring-teal-100" />) : (<button onClick={() => setEdit({ id: p.id, field })} className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-teal-50"><span>{p[field] === "" || p[field] == null ? <span className="text-stone-300">{placeholder}</span> : `${prefix}${Number(p[field]).toLocaleString("en-IN")}`}</span><Pencil className="h-3 w-3 text-stone-300 group-hover:text-teal-500" /></button>);
  };
  const CatCell = ({ p }) => {
    const active = edit && edit.id === p.id && edit.field === "category";
    return active ? (<input autoFocus list="inv-cats" defaultValue={p.category} onBlur={(e) => { patch(p.id, "category", e.target.value); setEdit(null); }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className="w-36 rounded-md border border-teal-400 px-2 py-1 text-sm outline-none ring-2 ring-teal-100" />) : (<button onClick={() => setEdit({ id: p.id, field: "category" })} className="group inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-teal-50"><span>{p.category}</span><Pencil className="h-3 w-3 text-stone-300 group-hover:text-teal-500" /></button>);
  };
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <datalist id="inv-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-stone-800">Inventory</h2><p className="text-sm text-stone-500">Click any price, cost, units, order cap, or category to edit it here.</p></div><div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product name…" className={inputCls + " w-64 pl-9"} /></div><select value={cat} onChange={(e) => setCat(e.target.value)} className={inputCls + " w-40"}><option>All</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></div></div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-400"><th className="pb-3 pl-2 font-semibold">Product</th><th className="pb-3 font-semibold">Category</th><th className="pb-3 font-semibold">Price</th><th className="pb-3 font-semibold"><span className="inline-flex items-center gap-1">Cost <HelpTip text="Backend only. What you pay per unit." /></span></th><th className="pb-3 font-semibold">Margin</th><th className="pb-3 font-semibold"><span className="inline-flex items-center gap-1">Units <HelpTip text="True backend count. Amber ≤5, red at 0." /></span></th><th className="pb-3 font-semibold"><span className="inline-flex items-center gap-1">Order cap <HelpTip text="Max a customer can buy per order. Blank = no limit." /></span></th><th className="pb-3 font-semibold">Customer view</th><th className="pb-3 font-semibold">Status</th><th className="pb-3 pr-2 font-semibold text-right">Edit</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const out = p.stock <= 0, low = p.stock > 0 && p.stock <= LOW_STOCK, m = marginPct(p.price, p.cost);
              return (<tr key={p.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/60"><td className="py-3 pl-2"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-100 to-amber-100 text-teal-500"><Sparkles className="h-4 w-4" /></div><span className="font-medium text-stone-800">{p.name}</span></div></td><td className="py-3"><CatCell p={p} /></td><td className="py-3"><NumCell p={p} field="price" prefix="₹" /></td><td className="py-3"><NumCell p={p} field="cost" prefix="₹" /></td><td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${m >= 40 ? "bg-emerald-50 text-emerald-700" : m > 0 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{m}%</span></td><td className="py-3"><span className={`inline-flex items-center gap-1.5 ${out ? "text-rose-600" : low ? "text-amber-600" : "text-stone-700"}`}>{(out || low) && <AlertTriangle className="h-3.5 w-3.5" />}<NumCell p={p} field="stock" /></span></td><td className="py-3"><NumCell p={p} field="maxPerOrder" placeholder="—" /></td><td className="py-3"><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">{stockLabel[p.stockMode]}</span></td><td className="py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${p.published ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{p.published ? "Published" : "Hidden"}</span></td><td className="py-3 pr-2 text-right"><button onClick={() => onOpen(p.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"><Pencil className="h-3.5 w-3.5" /> Open</button></td></tr>);
            })}
            {rows.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-stone-400">No products match “{search}”.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------- App ------------------------------- */
export default function App() {
  const [products, setProducts] = useState(SEED);
  const [view, setView] = useState("editor");
  const [selectedId, setSelectedId] = useState(SEED[0].id);
  const [draft, setDraft] = useState(SEED[0]);
  const [toast, setToast] = useState("");
  const categories = useMemo(() => [...new Set([...BASE_CATEGORIES, ...products.map((p) => p.category).filter(Boolean)])], [products]);
  const original = products.find((p) => p.id === selectedId);
  const dirty = JSON.stringify(original) !== JSON.stringify(draft);
  useEffect(() => { setDraft(products.find((p) => p.id === selectedId)); }, [selectedId]);
  const save = () => { setProducts(products.map((p) => (p.id === draft.id ? draft : p))); setToast("Saved — your shop is updated"); setTimeout(() => setToast(""), 2200); };
  const openInEditor = (id) => { setSelectedId(id); setView("editor"); };
  const lowCount = products.filter((p) => p.stock <= LOW_STOCK).length;
  const NavBtn = ({ id, icon: Icon, label, badge }) => (<button onClick={() => setView(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${view === id ? "bg-teal-600 text-white shadow-sm" : "text-stone-600 hover:bg-stone-100"}`}><Icon className="h-4 w-4" /><span className="flex-1 text-left">{label}</span>{badge > 0 && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${view === id ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}>{badge}</span>}</button>);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap');
        @keyframes savvyShine { 0%{transform:translateX(-130%) skewX(-20deg);} 55%,100%{transform:translateX(360%) skewX(-20deg);} }
        .badge-shine{position:relative; overflow:hidden;}
        .badge-shine::after{content:""; position:absolute; top:0; left:0; height:100%; width:45%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent); animation:savvyShine 2.2s ease-in-out infinite;}
        @keyframes savvyPulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.09);} }
        .badge-pulse{animation:savvyPulse 1.1s ease-in-out infinite;}
        @keyframes savvyWiggle { 0%,100%{transform:rotate(-4deg);} 50%{transform:rotate(4deg);} }
        .badge-wiggle{animation:savvyWiggle 0.7s ease-in-out infinite;}
        @keyframes goldMove {0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .gold-shimmer{background:linear-gradient(135deg,#bf953f,#fcf6ba,#b38728,#fbf5b7,#aa771c,#fcf6ba,#bf953f); background-size:300% 300%; animation:goldMove 3s ease infinite; box-shadow:0 6px 18px rgba(191,149,63,.32);}
        @keyframes goldSweep {0%{left:-55%}60%,100%{left:130%}}
        /* 95% teal button; the 5% gold only reveals on hover / touch */
        .teal-cta{position:relative; overflow:hidden; background:#0d9488; color:#fff; border:2px solid #0d9488; transition:border-color .3s ease, box-shadow .3s ease, background-color .3s ease;}
        .teal-cta:not(.is-gold):hover{background:#0f766e;}
        .teal-cta.is-gold{border-color:#d4af37; box-shadow:0 6px 18px rgba(212,175,55,.45);}
        .teal-cta::before{content:""; position:absolute; top:0; left:-55%; width:32%; height:100%; background:linear-gradient(90deg,transparent,rgba(212,175,55,.9),transparent); transform:skewX(-20deg); opacity:0;}
        .teal-cta.is-gold::before{opacity:1; animation:goldSweep 1.5s ease-in-out infinite;}
        .card-react{transition:transform .28s ease, box-shadow .28s ease, filter .28s ease;}
        @media (prefers-reduced-motion: reduce){ .badge-shine::after,.badge-pulse,.badge-wiggle,.gold-shimmer,.teal-cta.is-gold::before{animation:none;} }
      `}</style>
      <div className="mx-auto flex max-w-7xl gap-6 p-4 sm:p-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="mb-6 flex items-center gap-2 px-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white"><Sparkles className="h-5 w-5" /></div><div><div className="font-bold leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>Savvy In Teal</div><div className="text-xs text-stone-400">Store manager</div></div></div>
          <nav className="space-y-1"><NavBtn id="editor" icon={Package} label="Products" /><NavBtn id="inventory" icon={Boxes} label="Inventory" badge={lowCount} /><div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-300">More</div><NavBtn id="_a" icon={LayoutGrid} label="Dashboard" /><NavBtn id="_b" icon={ShoppingBag} label="Orders" /></nav>
          {lowCount > 0 && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><div className="mb-1 flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Running low</div>{lowCount} product{lowCount > 1 ? "s" : ""} at or below {LOW_STOCK} units. Check Inventory.</div>}
        </aside>
        <main className="min-w-0 flex-1">
          <header className="mb-5 flex items-center justify-between"><div><h1 className="text-xl font-bold text-stone-900">{view === "inventory" ? "Inventory" : view === "editor" ? "Products" : "Coming soon"}</h1><p className="text-sm text-stone-500">{view === "editor" ? "Pick a product, edit it, watch the preview." : view === "inventory" ? "Everything you sell, in one searchable list." : "Placeholder in this demo."}</p></div>{view === "editor" && <select value={selectedId} onChange={(e) => setSelectedId(+e.target.value)} className={inputCls + " w-64"}>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}</header>
          {view === "editor" && <Editor draft={draft} setDraft={setDraft} onSave={save} onReset={() => setDraft(original)} dirty={dirty} products={products} categories={categories} />}
          {view === "inventory" && <Inventory products={products} setProducts={setProducts} onOpen={openInEditor} categories={categories} />}
          {(view === "_a" || view === "_b") && <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-16 text-center text-stone-400">Your {view === "_a" ? "sales dashboard" : "orders"} would live here.</div>}
        </main>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-stone-800 px-4 py-3 text-sm font-semibold text-white shadow-xl"><CircleCheck className="h-4 w-4 text-emerald-400" /> {toast}</div>}
    </div>
  );
}
