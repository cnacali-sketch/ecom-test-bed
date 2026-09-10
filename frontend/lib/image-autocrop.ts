// Choose *where* to crop, instead of always taking the middle.
//
// A portrait phone photo is 3:4 and the product slot wants 4:5, so something
// has to go. The old behaviour trimmed equally from the top and bottom, which
// is right only when the product happens to sit dead centre — and on a photo
// shot at arm's length it usually does not. This picks the offset that keeps
// the most detail.
//
// Deliberately no ML and no dependency. Product photography is a busy subject
// on a calm background, so plain gradient energy separates the two well, and
// the whole thing runs on a ~96px thumbnail in well under a millisecond.
//
// This module is pure: it takes raw RGBA bytes and returns a normalised rect.
// That keeps it testable without a canvas or a DOM.

/** Raw RGBA pixels — the shape of `ImageData`, minus the DOM dependency. */
export interface PixelSample {
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
}

/** Crop window as fractions of the source (0..1), origin top-left. */
export interface NormalisedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Longest edge of the thumbnail the caller should hand us. Small on purpose:
 * gradient energy survives downscaling, and this keeps the scan trivial. */
export const SAMPLE_EDGE = 96;

/** How strongly to prefer a centred window when energy is close to uniform.
 * Without it a flat lay on a plain background drifts to an arbitrary edge,
 * which looks like a bug even though the score is legitimately tied. */
const CENTRE_BIAS = 0.18;

/** Rec. 601 luma. Matching the eye's green sensitivity matters here: a green
 * product against a grey background is invisible to a plain RGB average. */
function luma(data: Uint8ClampedArray | number[], index: number): number {
  return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
}

/**
 * Forward-difference gradient magnitude per pixel.
 *
 * Cheaper than Sobel and good enough at this scale — we only need to know
 * which regions have detail, not to trace edges accurately.
 */
function energyMap(sample: PixelSample): Float64Array {
  const { data, width, height } = sample;
  const energy = new Float64Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const here = luma(data, index);
      const right = x + 1 < width ? luma(data, index + 4) : here;
      const below = y + 1 < height ? luma(data, index + width * 4) : here;
      energy[y * width + x] = Math.abs(right - here) + Math.abs(below - here);
    }
  }
  return energy;
}

/** Summed-area table, so any window's total is four lookups regardless of
 * size. Padded by one row and column to avoid bounds checks when summing. */
function integrate(energy: Float64Array, width: number, height: number): Float64Array {
  const table = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += energy[y * width + x];
      table[(y + 1) * (width + 1) + (x + 1)] = table[y * (width + 1) + (x + 1)] + rowSum;
    }
  }
  return table;
}

function windowSum(
  table: Float64Array,
  stride: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  const x0 = x;
  const y0 = y;
  const x1 = x + w;
  const y1 = y + h;
  return (
    table[y1 * stride + x1] -
    table[y0 * stride + x1] -
    table[y1 * stride + x0] +
    table[y0 * stride + x0]
  );
}

/**
 * Best placement for an aspect-locked crop window.
 *
 * The window is always the largest one that fits, so this never throws away
 * more of the photo than the target shape strictly requires — it only decides
 * *where* along the free axis to take it. That keeps auto-crop predictable:
 * it can reframe, but it can never silently zoom in.
 *
 * `aspect` is width / height. Pass the source's own aspect (or omit) and the
 * result is the whole image.
 */
export function autoCropRect(sample: PixelSample, aspect: number): NormalisedRect {
  const { width, height } = sample;
  if (!width || !height || !Number.isFinite(aspect) || aspect <= 0) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }

  // Largest window of the requested shape that still fits inside the source.
  let cropW = width;
  let cropH = height;
  if (width / height > aspect) {
    cropW = Math.max(1, Math.round(height * aspect));
  } else {
    cropH = Math.max(1, Math.round(width / aspect));
  }

  const freeX = width - cropW;
  const freeY = height - cropH;
  // Already the right shape — nothing to place.
  if (freeX <= 0 && freeY <= 0) return { x: 0, y: 0, w: 1, h: 1 };

  const energy = energyMap(sample);
  const table = integrate(energy, width, height);
  const stride = width + 1;

  let bestX = Math.round(freeX / 2);
  let bestY = Math.round(freeY / 2);
  let bestScore = -Infinity;
  let bestOffCentre = Infinity;
  const area = cropW * cropH;
  // Scores are mean energy per pixel, so this epsilon is meaningful in absolute
  // terms rather than depending on how large the image is.
  const TIE = 1e-9;

  // One axis is always zero-length, so this is a line scan, not a grid scan.
  for (let y = 0; y <= freeY; y += 1) {
    for (let x = 0; x <= freeX; x += 1) {
      const mean = windowSum(table, stride, x, y, cropW, cropH) / area;
      // Distance of this window's centre from the image centre, 0..1.
      const offCentre =
        (freeX > 0 ? Math.abs(x - freeX / 2) / (freeX / 2) : 0) +
        (freeY > 0 ? Math.abs(y - freeY / 2) / (freeY / 2) : 0);
      const score = mean * (1 - CENTRE_BIAS * offCentre);
      // The tie-break is not decoration: on a perfectly flat image every
      // window scores zero, and a purely multiplicative bias cannot separate
      // them — the scan would keep whichever it saw first, i.e. the top-left
      // corner. Preferring the centred window on a tie is what makes a plain
      // background behave sanely.
      const better =
        score > bestScore + TIE ||
        (score > bestScore - TIE && offCentre < bestOffCentre);
      if (better) {
        bestScore = score;
        bestOffCentre = offCentre;
        bestX = x;
        bestY = y;
      }
    }
  }

  return {
    x: bestX / width,
    y: bestY / height,
    w: cropW / width,
    h: cropH / height,
  };
}
