// Turn a straight-off-the-phone photo into something the media library will
// accept: correctly rotated, cropped to the slot's shape, resized, and
// re-encoded as WebP under a byte budget.
//
// Why this exists: a portrait phone photo is 3:4 (0.75) and 3-8 MB. The
// product slot wants 4:5 (0.80) at =<250 KB. Both checks failed, and the only
// advice the UI could offer was "try squoosh.app" — so shooting a product on
// a phone and uploading it was impossible without desktop image editing.
//
// Nothing here is silent. `prepareImage` reports what it changed so the UI can
// say so: cropping loses part of the photo, and the owner has to know which
// part, which is exactly the complaint the original ImageDrop comment records.
//
// The pieces are exported individually because ImageEditor drives them
// interactively — decode once, then re-render on every drag — rather than
// running the whole pipeline per keystroke.

import { SAMPLE_EDGE, autoCropRect, type NormalisedRect } from "./image-autocrop";

/** Quarter turns only. Free-angle rotation would need edge fill, and there is
 * nothing sensible to fill a product photo's corners with. */
export type Rotation = 0 | 90 | 180 | 270;

/** Anything canvas can draw from. */
export type Drawable = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

export interface PrepareOptions {
  /** Target aspect ratio (width / height). Omit to keep the original shape. */
  aspect?: number;
  /** Longest-edge cap in px. The image is never enlarged past its own size. */
  maxWidth: number;
  maxHeight: number;
  /** Hard byte budget for the encoded result. */
  maxBytes: number;
  /**
   * Explicit crop window, normalised 0..1 against the *oriented* image.
   * Omit and the image is centre-cropped to `aspect`, which is what every
   * caller did before the editor existed.
   */
  crop?: NormalisedRect;
  rotate?: Rotation;
  flip?: boolean;
  /**
   * How to place the crop when `crop` is not given. "centre" is the historical
   * behaviour; "auto" scans the photo and frames the busiest region, which is
   * what bulk uploads want — nobody is going to hand-place forty crops.
   */
  place?: "centre" | "auto";
}

export interface PreparedImage {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  /** Percentage of the original area removed by cropping (0 when untouched). */
  croppedPercent: number;
  /** False when the browser could not encode WebP and we fell back to JPEG. */
  isWebp: boolean;
}

/** Quality ladder for the encoder. 0.82 is visually indistinguishable for
 * product photography; below ~0.5 WebP starts showing blocking on fabric and
 * hair, so we drop resolution instead of going lower. */
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52];
/** Applied repeatedly if even the lowest quality misses the byte budget. */
const DOWNSCALE_STEP = 0.8;
const MIN_DIMENSION = 400;

function supportsWebpEncode(): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
}

/**
 * Decode with EXIF orientation applied.
 *
 * Phone cameras store the sensor's raw landscape frame plus an orientation
 * flag. Drawing an undecorated bitmap to canvas ignores that flag, so every
 * portrait photo would upload rotated 90 degrees. `imageOrientation:
 * "from-image"` is the fix; the <img> fallback covers browsers without
 * createImageBitmap options (older Safari), where the tag itself applies EXIF.
 */
export async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to the <img> path
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not decode that image."));
      img.src = url;
    });
  } finally {
    // Revoked after decode: the bitmap keeps its own copy of the pixels.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function sourceSize(source: Drawable): { w: number; h: number } {
  if (source instanceof HTMLImageElement) {
    return { w: source.naturalWidth, h: source.naturalHeight };
  }
  return { w: source.width, h: source.height };
}

/**
 * Bake a quarter-turn and/or mirror into a new canvas.
 *
 * Done up front rather than folded into the crop maths so that every later
 * step — the crop rect, the editor's drag handles, the preview — works in one
 * coordinate space that matches what the user is looking at. Identity returns
 * the source untouched, so the common case allocates nothing.
 */
export function orientImage(source: Drawable, rotate: Rotation = 0, flip = false): Drawable {
  if (rotate === 0 && !flip) return source;

  const { w, h } = sourceSize(source);
  const swapped = rotate === 90 || rotate === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swapped ? h : w;
  canvas.height = swapped ? w : h;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process that image in this browser.");

  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotate * Math.PI) / 180);
  if (flip) context.scale(-1, 1);
  context.drawImage(source, -w / 2, -h / 2);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Centre-crop rect for a target aspect, as fractions of the source. */
export function centreCropRect(srcW: number, srcH: number, aspect?: number): NormalisedRect {
  if (!aspect || !srcW || !srcH) return { x: 0, y: 0, w: 1, h: 1 };
  let cropW = srcW;
  let cropH = srcH;
  if (srcW / srcH > aspect) {
    cropW = Math.round(srcH * aspect);
  } else {
    cropH = Math.round(srcW / aspect);
  }
  return {
    x: (srcW - cropW) / 2 / srcW,
    y: (srcH - cropH) / 2 / srcH,
    w: cropW / srcW,
    h: cropH / srcH,
  };
}

/**
 * Auto-placed crop for a target aspect.
 *
 * Lives here rather than in image-autocrop because it needs a canvas to get at
 * the pixels, and that module is deliberately DOM-free so it can be unit
 * tested without a browser.
 */
export function autoCropForSource(source: Drawable, aspect: number): NormalisedRect {
  const { w, h } = sourceSize(source);
  const scale = Math.min(SAMPLE_EDGE / Math.max(w, h), 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  // No 2D context is not worth failing an upload over — fall back to centre.
  if (!context) return centreCropRect(w, h, aspect);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return autoCropRect(context.getImageData(0, 0, canvas.width, canvas.height), aspect);
}

export interface RenderRequest {
  source: Drawable;
  /** Normalised against `source`, which must already be oriented. */
  crop: NormalisedRect;
  maxWidth: number;
  maxHeight: number;
  maxBytes: number;
  /** Used for the output filename; the extension is replaced. */
  name: string;
  originalBytes: number;
}

/**
 * Draw the crop, resize it into the slot, and encode under the byte budget.
 *
 * Quality is stepped down first and resolution only after that, because a
 * smaller sharp image reads as worse on a product grid than a full-size one
 * carrying a little more compression.
 */
export async function renderPrepared(request: RenderRequest): Promise<PreparedImage> {
  const { w: srcW, h: srcH } = sourceSize(request.source);
  if (!srcW || !srcH) throw new Error("Could not read that image.");

  const cropX = Math.round(request.crop.x * srcW);
  const cropY = Math.round(request.crop.y * srcH);
  const cropW = Math.max(1, Math.round(request.crop.w * srcW));
  const cropH = Math.max(1, Math.round(request.crop.h * srcH));
  const croppedPercent = Math.round((1 - (cropW * cropH) / (srcW * srcH)) * 100);

  // Never upscale: enlarging a small photo adds bytes and no detail.
  const scale = Math.min(request.maxWidth / cropW, request.maxHeight / cropH, 1);
  let targetW = Math.max(1, Math.round(cropW * scale));
  let targetH = Math.max(1, Math.round(cropH * scale));

  const mimeType = supportsWebpEncode() ? "image/webp" : "image/jpeg";
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not process that image in this browser.");

  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    canvas.width = targetW;
    canvas.height = targetH;
    context.clearRect(0, 0, targetW, targetH);
    context.drawImage(request.source, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

    for (const quality of QUALITY_STEPS) {
      const candidate = await toBlob(canvas, mimeType, quality);
      if (candidate && candidate.size <= request.maxBytes) {
        blob = candidate;
        break;
      }
      blob = candidate ?? blob;
    }
    if (blob && blob.size <= request.maxBytes) break;

    // Still too heavy at the lowest acceptable quality — shed resolution.
    if (Math.min(targetW, targetH) <= MIN_DIMENSION) break;
    targetW = Math.max(MIN_DIMENSION, Math.round(targetW * DOWNSCALE_STEP));
    targetH = Math.max(MIN_DIMENSION, Math.round(targetH * DOWNSCALE_STEP));
  }

  if (!blob) throw new Error("Could not compress that image.");

  const extension = mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = request.name.replace(/\.[^.]+$/, "") || "photo";
  return {
    file: new File([blob], `${baseName}.${extension}`, { type: mimeType }),
    width: targetW,
    height: targetH,
    originalBytes: request.originalBytes,
    croppedPercent: Math.max(0, croppedPercent),
    isWebp: mimeType === "image/webp",
  };
}

export async function prepareImage(file: File, options: PrepareOptions): Promise<PreparedImage> {
  const decoded = await decodeImage(file);
  const source = orientImage(decoded, options.rotate ?? 0, options.flip ?? false);
  const { w, h } = sourceSize(source);

  const autoPlaced = options.place === "auto" && options.aspect;
  const crop =
    options.crop ??
    (autoPlaced
      ? autoCropForSource(source, options.aspect as number)
      : centreCropRect(w, h, options.aspect));
  try {
    return await renderPrepared({
      source,
      crop,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      maxBytes: options.maxBytes,
      name: file.name,
      originalBytes: file.size,
    });
  } finally {
    // Safe either way: when orientImage returned a new canvas it has already
    // copied the pixels, and when it returned the bitmap itself the render is
    // finished by the time this runs.
    if (decoded instanceof ImageBitmap) decoded.close();
  }
}
