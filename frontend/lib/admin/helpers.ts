// Small pure helpers shared across admin screens.
import type { AdminDims } from "./types";

export const rupee = (n: number): string => "₹" + Number(n || 0).toLocaleString("en-IN");

export const discount = (mrp: number, price: number): number =>
  mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

export const marginPct = (price: number, cost: number): number =>
  price > 0 ? Math.round(((price - cost) / price) * 100) : 0;

export const fmtSize = (b: number): string =>
  b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.round(b / 1024) + " KB";

export const uid = (): string => Math.random().toString(36).slice(2, 9);

/** #rrggbb (or #rgb) + alpha 0..1 -> rgba(). Used so a badge can sit semi-transparent over a photo. */
export const hexToRgba = (hex: string, a: number): string => {
  const h = (hex || "#000").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export const dimStr = (d: AdminDims | undefined): string => {
  if (!d) return "";
  const { h, w, l, unit } = d;
  if (!(h && w)) return "";
  return (l ? `${h} × ${w} × ${l}` : `${h} × ${w}`) + ` ${unit || "cm"}`;
};

// ---- fuzzy duplicate-name detection (editor warns on near-identical names) ----

const norm = (s: string): string =>
  (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

const lev = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[m][n];
};

export const similarity = (a: string, b: string): number => {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const r = 1 - lev(na, nb) / Math.max(na.length, nb.length);
  const A = new Set(na.split(" ")), B = new Set(nb.split(" "));
  const j = [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size;
  const c = na.includes(nb) || nb.includes(na) ? 0.85 : 0;
  return Math.max(r, j, c);
};
