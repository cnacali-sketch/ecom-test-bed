"use client";

// Back-office calculators and generators.
//
// These five endpoints all existed, worked, and were admin-gated, but nothing
// in the console called them -- working backend features no user could reach:
//   POST /api/pricing/markup      cost + markup %        -> retail price
//   POST /api/pricing/margin      cost + price          -> margin %
//   POST /api/pricing/break-even  fixed/variable + price -> units to break even
//   POST /api/inventory/sku       brand/category/size    -> bulk SKUs
//   POST /api/inventory/barcode   numeric code           -> PNG/SVG image bytes
//
// The margin calculator overlaps the per-product margin ProductEditor already
// computes locally, and deliberately so: this one takes arbitrary numbers for
// "what if I bought at X and sold at Y", rather than reporting on the product
// currently open.
//
// Careful with /api/pricing/markup: its `margin_pct` parameter is misnamed.
// It computes cost * (1 + pct/100) -- MARKUP ON COST -- while /api/pricing/
// margin returns true gross margin (price - cost) / price, the same formula
// helpers.marginPct uses everywhere else in the admin. The two are not
// inverses: 250 at "40" yields 350, whose real margin is 28.6%. Labelled here
// as markup, with the resulting true margin shown next to it, so nobody reads
// one number as the other.

import { Barcode, Calculator, Copy, Download, Tags } from "lucide-react";
import { useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { marginPct, rupee } from "@/lib/admin/helpers";
import { inputCls } from "../atoms";

const btnCls =
  "rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-deep disabled:cursor-not-allowed disabled:bg-ink/30";

/** Every tool here fails the same three ways: unreachable, session expired, or
 * a 422 the backend explains itself. Keep one phrasing for all of them. */
async function failureMessage(res: Response | null, fallback: string): Promise<string> {
  if (!res) return "Couldn't reach the server. Check your connection and try again.";
  if (res.status === 401 || res.status === 403)
    return "Your admin session has expired. Please log out and log back in.";
  const body = await res.json().catch(() => null);
  const detail = (body as { detail?: unknown } | null)?.detail;
  return typeof detail === "string" ? detail : fallback;
}

function Card({
  icon: Icon,
  title,
  blurb,
  children,
}: {
  icon: typeof Calculator;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Icon className="h-4 w-4 text-teal" /> {title}
        </h2>
        <p className="text-sm text-ink-soft">{blurb}</p>
      </div>
      {children}
    </section>
  );
}

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="mt-3 rounded-lg bg-sale/5 px-3 py-2 text-xs text-sale">{msg}</p>;
}

function NumField({
  label,
  value,
  onChange,
  prefix,
  step = "0.01",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</span>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-soft/60">{prefix}</span>
        )}
        <input
          type="number"
          step={step}
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls + (prefix ? " pl-7" : "")}
        />
      </div>
    </label>
  );
}

// ---------------------------------------------------------------- pricing ---

function PricingTools() {
  const [markup, setMarkup] = useState({ cost: "", margin_pct: "" });
  const [markupOut, setMarkupOut] = useState<string | null>(null);
  const [markupErr, setMarkupErr] = useState<string | null>(null);

  const [margin, setMargin] = useState({ cost: "", price: "" });
  const [marginOut, setMarginOut] = useState<string | null>(null);
  const [marginErr, setMarginErr] = useState<string | null>(null);

  const [be, setBe] = useState({ fixed_costs: "", price: "", variable_cost: "" });
  const [beOut, setBeOut] = useState<string | null>(null);
  const [beErr, setBeErr] = useState<string | null>(null);

  const [busy, setBusy] = useState<string | null>(null);

  async function post(
    path: string,
    body: Record<string, string>,
    onOk: (json: Record<string, string>) => void,
    onErr: (msg: string) => void,
  ) {
    setBusy(path);
    try {
      const res = await apiFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res?.ok) {
        onErr(await failureMessage(res, "That calculation was rejected. Check the numbers."));
        return;
      }
      onErr("");
      onOk((await res.json()) as Record<string, string>);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      icon={Calculator}
      title="Pricing calculators"
      blurb="Server-side maths, so a price you quote here matches what the backend would compute."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* markup: cost + margin -> price */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ink">Price from markup</h3>
          <NumField label="Cost per unit" prefix="₹" value={markup.cost} onChange={(v) => setMarkup((m) => ({ ...m, cost: v }))} />
          <NumField label="Markup on cost %" value={markup.margin_pct} onChange={(v) => setMarkup((m) => ({ ...m, margin_pct: v }))} />
          <p className="text-[11px] leading-relaxed text-ink-soft/70">
            Markup is added to cost. It is not the same as margin — 40% markup on ₹250 gives ₹350,
            which is a 28.6% margin.
          </p>
          <button
            type="button"
            className={btnCls}
            disabled={!markup.cost || !markup.margin_pct || busy !== null}
            onClick={() =>
              post(
                "/api/pricing/markup",
                markup,
                (j) => setMarkupOut(j.price),
                (m) => setMarkupErr(m || null),
              )
            }
          >
            Calculate
          </button>
          {markupOut && (
            <p className="rounded-lg bg-teal/10 px-3 py-2 text-sm font-semibold text-teal">
              Sell at {rupee(Number(markupOut))}
              <span className="ml-1 font-normal text-teal/80">
                — a {marginPct(Number(markupOut), Number(markup.cost))}% margin
              </span>
            </p>
          )}
          <Err msg={markupErr} />
        </div>

        {/* margin: cost + price -> margin% */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ink">Margin from price</h3>
          <NumField label="Cost per unit" prefix="₹" value={margin.cost} onChange={(v) => setMargin((m) => ({ ...m, cost: v }))} />
          <NumField label="Selling price" prefix="₹" value={margin.price} onChange={(v) => setMargin((m) => ({ ...m, price: v }))} />
          <button
            type="button"
            className={btnCls}
            disabled={!margin.cost || !margin.price || busy !== null}
            onClick={() =>
              post(
                "/api/pricing/margin",
                margin,
                (j) => setMarginOut(j.margin_pct),
                (m) => setMarginErr(m || null),
              )
            }
          >
            Calculate
          </button>
          {marginOut && (
            <p className="rounded-lg bg-teal/10 px-3 py-2 text-sm font-semibold text-teal">
              {Number(marginOut).toFixed(2)}% margin
            </p>
          )}
          <Err msg={marginErr} />
        </div>

        {/* break-even */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ink">Break-even units</h3>
          <NumField label="Fixed costs" prefix="₹" value={be.fixed_costs} onChange={(v) => setBe((b) => ({ ...b, fixed_costs: v }))} />
          <NumField label="Selling price" prefix="₹" value={be.price} onChange={(v) => setBe((b) => ({ ...b, price: v }))} />
          <NumField label="Variable cost / unit" prefix="₹" value={be.variable_cost} onChange={(v) => setBe((b) => ({ ...b, variable_cost: v }))} />
          <button
            type="button"
            className={btnCls}
            disabled={!be.fixed_costs || !be.price || !be.variable_cost || busy !== null}
            onClick={() =>
              post(
                "/api/pricing/break-even",
                be,
                (j) => setBeOut(j.break_even),
                (m) => setBeErr(m || null),
              )
            }
          >
            Calculate
          </button>
          {beOut && (
            <p className="rounded-lg bg-teal/10 px-3 py-2 text-sm font-semibold text-teal">
              {Math.ceil(Number(beOut)).toLocaleString("en-IN")} units to break even
            </p>
          )}
          <Err msg={beErr} />
        </div>
      </div>
    </Card>
  );
}

// -------------------------------------------------------------------- sku ---

function SkuTool() {
  const [form, setForm] = useState({ brand: "", category: "", size: "", count: "10", start_sequence: "1" });
  const [skus, setSkus] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function generate() {
    setBusy(true);
    setCopied(false);
    try {
      const res = await apiFetch("/api/inventory/sku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: form.brand.trim(),
          category: form.category.trim(),
          size: form.size.trim(),
          count: Number(form.count) || 1,
          start_sequence: Number(form.start_sequence) || 0,
        }),
      });
      if (!res?.ok) {
        setSkus([]);
        setErr(
          await failureMessage(res, "Brand, category and size must each be letters and numbers only."),
        );
        return;
      }
      setErr(null);
      setSkus(((await res.json()) as { skus: string[] }).skus);
    } finally {
      setBusy(false);
    }
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(skus.join("\n"));
      setCopied(true);
    } catch {
      setErr("Couldn't copy to the clipboard. Select the list and copy manually.");
    }
  }

  return (
    <Card
      icon={Tags}
      title="SKU generator"
      blurb="Bulk codes in BRAND-CATEGORY-SIZE-0001 form. Letters and numbers only in each part."
    >
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Brand</span>
          <input className={inputCls} value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="SAVVY" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Category</span>
          <input className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="CLIP" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Size</span>
          <input className={inputCls} value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="M" />
        </label>
        <NumField label="How many" step="1" value={form.count} onChange={(v) => set("count", v)} />
        <NumField label="Start at" step="1" value={form.start_sequence} onChange={(v) => set("start_sequence", v)} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className={btnCls}
          disabled={!form.brand || !form.category || !form.size || busy}
          onClick={generate}
        >
          {busy ? "Generating…" : "Generate"}
        </button>
        {skus.length > 0 && (
          <button
            type="button"
            onClick={copyAll}
            className="flex items-center gap-1.5 rounded-xl border border-ink/20 px-3 py-2 text-xs font-semibold text-ink-soft transition hover:bg-ink/5"
          >
            <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : `Copy all ${skus.length}`}
          </button>
        )}
      </div>
      <Err msg={err} />
      {skus.length > 0 && (
        <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-ink/5 p-3 font-mono text-xs text-ink-soft">
          {skus.join("\n")}
        </pre>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- barcode ---

function BarcodeTool() {
  const [code, setCode] = useState("");
  const [type, setType] = useState<"ean13" | "upca">("ean13");
  const [format, setFormat] = useState<"png" | "svg">("png");
  const [src, setSrc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const digits = type === "ean13" ? 12 : 11;

  async function generate() {
    setBusy(true);
    try {
      const res = await apiFetch("/api/inventory/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), barcode_type: type, format }),
      });
      if (!res?.ok) {
        setErr(await failureMessage(res, `Enter exactly ${digits} digits for ${type.toUpperCase()}.`));
        return;
      }
      setErr(null);
      // The endpoint returns raw image bytes, not JSON. Release the previous
      // object URL before replacing it, or every regenerate leaks one.
      setSrc((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      setSrc(URL.createObjectURL(await res.blob()));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      icon={Barcode}
      title="Barcode generator"
      blurb={`Scannable EAN-13 or UPC-A image. The check digit is added for you — enter ${digits} digits.`}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Code ({digits} digits)</span>
          <input
            className={inputCls + " font-mono"}
            value={code}
            inputMode="numeric"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, digits))}
            placeholder={"0".repeat(digits)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Symbology</span>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as "ean13" | "upca")}>
            <option value="ean13">EAN-13</option>
            <option value="upca">UPC-A</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Format</span>
          <select className={inputCls} value={format} onChange={(e) => setFormat(e.target.value as "png" | "svg")}>
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className={btnCls} disabled={code.length !== digits || busy} onClick={generate}>
          {busy ? "Generating…" : "Generate"}
        </button>
        {src && (
          <a
            href={src}
            download={`${code}.${format}`}
            className="flex items-center gap-1.5 rounded-xl border border-ink/20 px-3 py-2 text-xs font-semibold text-ink-soft transition hover:bg-ink/5"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        )}
      </div>
      <Err msg={err} />
      {src && (
        <div className="mt-4 inline-block rounded-lg border border-ink/10 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${type.toUpperCase()} barcode for ${code}`} className="max-h-40" />
        </div>
      )}
    </Card>
  );
}

export function Tools() {
  return (
    <div className="space-y-6">
      <PricingTools />
      <SkuTool />
      <BarcodeTool />
    </div>
  );
}
