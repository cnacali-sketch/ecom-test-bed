/**
 * Pick the right size of an image for the device asking for it.
 *
 * `next/image` was configured `unoptimized: true`, which meant it emitted a
 * bare `<img src>` and generated no srcset at all. Every `sizes` prop already
 * written across the storefront was therefore decorative: a phone downloaded
 * the same file as a 27-inch monitor. On the homepage that is 78 images served
 * at a fixed width to every visitor.
 *
 * A custom loader fixes that without reintroducing what `unoptimized` was
 * there to avoid. The config comment explains the original reason -- the Next
 * optimizer proxies remote images through the Node server and fails in some
 * proxy environments. A loader does no such thing: it is a pure function from
 * (src, width) to a URL, run while rendering, and nothing is proxied. The
 * failure mode that motivated `unoptimized` cannot occur here.
 *
 * Three kinds of source, three answers:
 *
 * - **Pexels** already resizes on demand through query parameters, so the
 *   width is rewritten and their CDN does the work. This is where nearly all
 *   of the saving is, because it is where nearly all of the images are.
 * - **Our own `/media`** has WebP derivatives generated on upload at fixed
 *   widths. The narrowest one that covers the request wins; anything wider
 *   than the largest derivative falls back to the original.
 * - **Everything else** is returned untouched. Guessing at a resizing API a
 *   host may not have would produce 404s instead of smaller images.
 */

/** Widths the backend generates. Mirrors DERIVATIVE_WIDTHS in
 *  `app/services/images.py`; adding one there without adding it here means the
 *  file is generated and never requested. */
export const MEDIA_WIDTHS = [400, 800, 1200] as const;

function mediaDerivative(src: string, width: number): string {
  const [path, query] = src.split("?", 2);
  const slash = path.lastIndexOf("/");
  const file = path.slice(slash + 1);
  const dot = file.lastIndexOf(".");
  const stem = dot === -1 ? file : file.slice(0, dot);

  // Already a derivative, or asking for more than the largest one we hold:
  // serve the original rather than a URL that resolves to nothing.
  const largest = MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1];
  if (/__w\d+$/.test(stem) || width > largest) return src;

  const chosen = MEDIA_WIDTHS.find((candidate) => candidate >= width);
  if (chosen === undefined) return src;

  return `${path.slice(0, slash + 1)}${stem}__w${chosen}.webp${query ? `?${query}` : ""}`;
}

function pexelsAtWidth(src: string, width: number): string {
  const [path, query = ""] = src.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("w", String(width));
  // The height is dropped rather than scaled. It was authored alongside a
  // fixed width to express a crop ratio; keeping it while the width changes
  // would ask Pexels for a different shape at every breakpoint, and the same
  // photograph would be cropped differently on a phone than on a laptop.
  params.delete("h");
  return `${path}?${params.toString()}`;
}

export default function imageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  if (!src) return src;
  if (src.includes("images.pexels.com")) return pexelsAtWidth(src, width);
  if (src.includes("/media/")) return mediaDerivative(src, width);
  return src;
}
