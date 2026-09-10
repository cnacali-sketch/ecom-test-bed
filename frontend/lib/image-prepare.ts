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

export interface PrepareOptions {
  /** Target aspect ratio (width / height). Omit to keep the original shape. */
  aspect?: number;
  /** Longest-edge cap in px. The image is never enlarged past its own size. */
  maxWidth: number;
  maxHeight: number;
  /** Hard byte budget for the encoded result. */
  maxBytes: number;
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
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
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

function sourceSize(source: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  return source instanceof HTMLImageElement
    ? { w: source.naturalWidth, h: source.naturalHeight }
    : { w: source.width, h: source.height };
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, options: PrepareOptions): Promise<PreparedImage> {
  const source = await decode(file);
  const { w: srcW, h: srcH } = sourceSize(source);
  if (!srcW || !srcH) throw new Error("Could not read that image.");

  // Centre-crop to the requested shape. Cropping from the centre keeps the
  // subject of a product shot, which is almost always centred in frame.
  let cropW = srcW;
  let cropH = srcH;
  if (options.aspect) {
    if (srcW / srcH > options.aspect) {
      cropW = Math.round(srcH * options.aspect);
    } else {
      cropH = Math.round(srcW / options.aspect);
    }
  }
  const cropX = Math.round((srcW - cropW) / 2);
  const cropY = Math.round((srcH - cropH) / 2);
  const croppedPercent = Math.round((1 - (cropW * cropH) / (srcW * srcH)) * 100);

  // Never upscale: enlarging a small photo adds bytes and no detail.
  const scale = Math.min(options.maxWidth / cropW, options.maxHeight / cropH, 1);
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
    context.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

    for (const quality of QUALITY_STEPS) {
      const candidate = await toBlob(canvas, mimeType, quality);
      if (candidate && candidate.size <= options.maxBytes) {
        blob = candidate;
        break;
      }
      blob = candidate ?? blob;
    }
    if (blob && blob.size <= options.maxBytes) break;

    // Still too heavy at the lowest acceptable quality — shed resolution.
    if (Math.min(targetW, targetH) <= MIN_DIMENSION) break;
    targetW = Math.max(MIN_DIMENSION, Math.round(targetW * DOWNSCALE_STEP));
    targetH = Math.max(MIN_DIMENSION, Math.round(targetH * DOWNSCALE_STEP));
  }

  if (source instanceof ImageBitmap) source.close();
  if (!blob) throw new Error("Could not compress that image.");

  const extension = mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return {
    file: new File([blob], `${baseName}.${extension}`, { type: mimeType }),
    width: targetW,
    height: targetH,
    originalBytes: file.size,
    croppedPercent: Math.max(0, croppedPercent),
    isWebp: mimeType === "image/webp",
  };
}
