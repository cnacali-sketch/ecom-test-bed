"use client";

// Place the crop before uploading, instead of finding out afterwards.
//
// Every slot on the site has a fixed shape, so a 3:4 phone photo always loses
// something on the way into a 4:5 card. The old flow cropped from the centre
// and reported the damage *after* the upload had already happened, which is
// the wrong order: by then the only remedy was to delete and reshoot.
//
// Everything here runs on the decoded bitmap that is already in memory, so
// dragging is instant. Only the byte estimate re-encodes, and that is
// debounced — a full encode per pointer move would make the drag stutter.

import {
  Check,
  Crop as CropIcon,
  FlipHorizontal,
  RotateCcw,
  RotateCw,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fmtSize } from "@/lib/admin/helpers";
import type { ImageSpec } from "@/lib/admin/types";
import type { NormalisedRect } from "@/lib/image-autocrop";
import {
  autoCropForSource,
  decodeImage,
  orientImage,
  renderPrepared,
  sourceSize,
  type Drawable,
  type PreparedImage,
  type Rotation,
} from "@/lib/image-prepare";

/** Longest edge of the interactive stage, in CSS pixels. */
const STAGE_EDGE = 320;
/** How far in the crop can be pushed. Past ~3x a phone photo starts showing
 * its own sensor noise, so there is nothing useful further in. */
const MAX_ZOOM = 3;
/** Arrow-key nudge, as a fraction of the image. */
const NUDGE = 0.01;
/** Re-encoding is the expensive part; wait for the drag to settle first. */
const ESTIMATE_DELAY_MS = 320;

/** Largest window of the target shape that fits, normalised 0..1. */
function maxWindow(srcW: number, srcH: number, aspect: number): { w: number; h: number } {
  if (srcW / srcH > aspect) {
    return { w: (srcH * aspect) / srcW, h: 1 };
  }
  return { w: 1, h: srcW / aspect / srcH };
}

function clampRect(rect: NormalisedRect): NormalisedRect {
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, 0), Math.max(0, 1 - rect.w)),
    y: Math.min(Math.max(rect.y, 0), Math.max(0, 1 - rect.h)),
  };
}

export function ImageEditor({
  file,
  spec,
  slotLabel,
  onCancel,
  onConfirm,
}: {
  file: File;
  spec: ImageSpec;
  /** Shown in the header, e.g. "Product photo". */
  slotLabel: string;
  onCancel: () => void;
  onConfirm: (prepared: PreparedImage) => void | Promise<void>;
}) {
  const aspect = spec.w / spec.h;

  const [decoded, setDecoded] = useState<Drawable | null>(null);
  const [rotate, setRotate] = useState<Rotation>(0);
  const [flip, setFlip] = useState(false);
  const [crop, setCrop] = useState<NormalisedRect | null>(null);
  /** Cached alongside the framing it was measured for, so "is this number
   * still current?" is a comparison rather than another piece of state. */
  const [estimate, setEstimate] = useState<{ key: string; result: PreparedImage } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const stageRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; w: number; h: number } | null>(null);

  // Decode once. Orientation and crop are applied on top of this bitmap, so
  // the file is never re-read.
  useEffect(() => {
    let cancelled = false;
    decodeImage(file)
      .then((bitmap) => {
        if (cancelled) return;
        setDecoded(bitmap);
        setCrop(autoCropForSource(bitmap, aspect));
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't read that image.");
      });
    return () => {
      cancelled = true;
    };
  }, [file, aspect]);

  const oriented = useMemo(
    () => (decoded ? orientImage(decoded, rotate, flip) : null),
    [decoded, rotate, flip],
  );

  const dims = useMemo(() => (oriented ? sourceSize(oriented) : null), [oriented]);

  // Stage geometry: the whole photo, letterboxed into STAGE_EDGE.
  const display = useMemo(() => {
    if (!dims) return null;
    const scale = Math.min(STAGE_EDGE / dims.w, STAGE_EDGE / dims.h);
    return { w: Math.round(dims.w * scale), h: Math.round(dims.h * scale) };
  }, [dims]);

  // Paint the photo behind the crop overlay.
  useEffect(() => {
    const canvas = stageRef.current;
    if (!canvas || !oriented || !display) return;
    canvas.width = display.w;
    canvas.height = display.h;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, display.w, display.h);
    context.drawImage(oriented, 0, 0, display.w, display.h);
  }, [oriented, display]);

  // Paint the "what actually ships" preview.
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !oriented || !crop || !dims) return;
    const previewW = 150;
    const previewH = Math.round(previewW / aspect);
    canvas.width = previewW;
    canvas.height = previewH;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, previewW, previewH);
    context.drawImage(
      oriented,
      crop.x * dims.w,
      crop.y * dims.h,
      crop.w * dims.w,
      crop.h * dims.h,
      0,
      0,
      previewW,
      previewH,
    );
  }, [oriented, crop, dims, aspect]);

  /** Identifies one exact framing. Rounded so floating-point drift in a drag
   * that lands back where it started does not read as a different crop. */
  const framingKey = crop
    ? `${rotate}|${flip}|${crop.x.toFixed(4)}|${crop.y.toFixed(4)}|${crop.w.toFixed(4)}`
    : "";
  const estimating = !estimate || estimate.key !== framingKey;

  // Byte estimate. Debounced, and guarded against out-of-order results so a
  // slow encode from an earlier crop cannot overwrite a newer one.
  useEffect(() => {
    if (!oriented || !crop) return;
    let stale = false;
    const timer = setTimeout(() => {
      renderPrepared({
        source: oriented,
        crop,
        maxWidth: spec.w,
        maxHeight: spec.h,
        maxBytes: spec.maxKB * 1024,
        name: file.name,
        originalBytes: file.size,
      })
        .then((result) => {
          if (!stale) setEstimate({ key: framingKey, result });
        })
        .catch(() => {
          // Leaving the readout on "measuring…" is honest here: we genuinely
          // do not know the size, and the Use photo button reports the real
          // failure if it happens again.
        });
    }, ESTIMATE_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [oriented, crop, framingKey, spec.w, spec.h, spec.maxKB, file.name, file.size]);

  const zoomTo = useCallback(
    (nextZoom: number) => {
      if (!dims || !crop) return;
      const max = maxWindow(dims.w, dims.h, aspect);
      const zoom = Math.min(Math.max(nextZoom, 1), MAX_ZOOM);
      const w = max.w / zoom;
      const h = max.h / zoom;
      // Zoom about the crop's centre so the framing does not jump.
      setCrop(
        clampRect({
          x: crop.x + (crop.w - w) / 2,
          y: crop.y + (crop.h - h) / 2,
          w,
          h,
        }),
      );
    },
    [dims, crop, aspect],
  );

  const currentZoom = useMemo(() => {
    if (!dims || !crop) return 1;
    const max = maxWindow(dims.w, dims.h, aspect);
    return max.h / crop.h;
  }, [dims, crop, aspect]);

  const panBy = useCallback(
    (dxPx: number, dyPx: number) => {
      if (!display) return;
      setCrop((previous) =>
        previous
          ? clampRect({
              ...previous,
              x: previous.x + dxPx / display.w,
              y: previous.y + dyPx / display.h,
            })
          : previous,
      );
    },
    [display],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      // Pinch: compare the current finger spread against the spread when the
      // second finger landed.
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      if (!pinchStart.current && crop) {
        pinchStart.current = { distance, w: crop.w, h: crop.h };
        return;
      }
      if (pinchStart.current && dims) {
        const max = maxWindow(dims.w, dims.h, aspect);
        const ratio = distance / pinchStart.current.distance;
        zoomTo((max.h / pinchStart.current.h) * ratio);
      }
      return;
    }
    // Dragging the photo moves it under a fixed frame, so the crop travels the
    // opposite way to the finger.
    panBy(-(event.clientX - previous.x), -(event.clientY - previous.y));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      onCancel();
      return;
    }
    const step = event.shiftKey ? NUDGE * 4 : NUDGE;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setCrop((previous) =>
      previous ? clampRect({ ...previous, x: previous.x + move[0], y: previous.y + move[1] }) : previous,
    );
  }

  function turn(delta: number) {
    if (!decoded) return;
    const next = (((rotate + delta) % 360) + 360) % 360 as Rotation;
    // Recompute placement in the handler rather than an effect: the old crop
    // is meaningless in the new coordinate space, and deriving it here keeps
    // rotation a single atomic state change.
    const rotated = orientImage(decoded, next, flip);
    setRotate(next);
    setCrop(autoCropForSource(rotated, aspect));
  }

  function mirror() {
    if (!decoded) return;
    const next = !flip;
    setFlip(next);
    setCrop((previous) => (previous ? clampRect({ ...previous, x: 1 - previous.x - previous.w }) : previous));
  }

  async function confirm() {
    if (!oriented || !crop) return;
    setSaving(true);
    setError("");
    try {
      const prepared = await renderPrepared({
        source: oriented,
        crop,
        maxWidth: spec.w,
        maxHeight: spec.h,
        maxBytes: spec.maxKB * 1024,
        name: file.name,
        originalBytes: file.size,
      });
      await onConfirm(prepared);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't process that image.");
      setSaving(false);
    }
  }

  const trimmed = estimate?.result.croppedPercent ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Crop ${slotLabel}`}
        tabIndex={-1}
        autoFocus
        onKeyDown={onKeyDown}
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-card p-5 shadow-xl outline-none"
      >
        <div className="mb-4 flex items-center gap-2">
          <CropIcon className="h-5 w-5 text-teal" />
          <h2 className="text-base font-semibold text-ink">{slotLabel}</h2>
          <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
            {spec.shape} · {spec.w}×{spec.h} · ≤{spec.maxKB} KB
          </span>
          <button
            onClick={onCancel}
            aria-label="Cancel"
            className="ml-auto rounded-lg p-1.5 text-ink-soft hover:bg-ink/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="flex-1">
            {display && crop ? (
              <div
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={(event) => zoomTo(currentZoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08))}
                style={{ width: display.w, height: display.h, touchAction: "none" }}
                className="relative mx-auto cursor-move select-none overflow-hidden rounded-xl bg-ink/5"
              >
                <canvas ref={stageRef} className="block h-full w-full" />
                <div
                  aria-hidden
                  style={{
                    left: crop.x * display.w,
                    top: crop.y * display.h,
                    width: crop.w * display.w,
                    height: crop.h * display.h,
                  }}
                  className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(13,22,21,0.55)]"
                />
              </div>
            ) : (
              <div
                style={{ height: STAGE_EDGE }}
                className="flex items-center justify-center rounded-xl bg-ink/5 text-sm text-ink-soft"
              >
                {error || "Loading photo…"}
              </div>
            )}

            <label className="mt-3 flex items-center gap-3 text-xs font-semibold text-ink-soft">
              Zoom
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={currentZoom}
                onChange={(event) => zoomTo(Number(event.target.value))}
                className="flex-1 accent-teal"
              />
            </label>

            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => decoded && oriented && setCrop(autoCropForSource(oriented, aspect))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal/10 px-2.5 py-1.5 text-xs font-semibold text-teal hover:bg-teal/15"
              >
                <Sparkles className="h-3.5 w-3.5" /> Auto
              </button>
              <button
                onClick={() => turn(-90)}
                aria-label="Rotate left"
                className="rounded-lg bg-ink/5 p-1.5 text-ink-soft hover:bg-ink/10"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                onClick={() => turn(90)}
                aria-label="Rotate right"
                className="rounded-lg bg-ink/5 p-1.5 text-ink-soft hover:bg-ink/10"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <button
                onClick={mirror}
                aria-label="Flip horizontally"
                className="rounded-lg bg-ink/5 p-1.5 text-ink-soft hover:bg-ink/10"
              >
                <FlipHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="sm:w-44">
            <div className="text-xs font-semibold text-ink-soft">Preview</div>
            <canvas
              ref={previewRef}
              className="mt-1.5 w-full rounded-lg border border-ink/10 bg-ink/5"
            />
            <div className="mt-2 space-y-1 text-xs text-ink-soft">
              <div>
                {spec.w}×{spec.h} ·{" "}
                {estimating || !estimate ? (
                  <span className="text-ink-soft/60">measuring…</span>
                ) : (
                  <span className={estimate.result.file.size <= spec.maxKB * 1024 ? "text-teal" : "text-sale"}>
                    {fmtSize(estimate.result.file.size)}
                  </span>
                )}
              </div>
              <div className="text-ink-soft/70">from {fmtSize(file.size)}</div>
              {trimmed > 0 && (
                <div className="text-ink-soft/70">{trimmed}% of the photo trimmed</div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg bg-ink/5 px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-ink/10"
              >
                Cancel
              </button>
              <button
                onClick={confirm}
                disabled={!crop || saving}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> {saving ? "Uploading…" : "Use photo"}
              </button>
            </div>
          </div>
        </div>

        {error && crop && (
          <div className="mt-3 rounded-lg bg-sale/5 px-3 py-2 text-xs font-medium text-sale">{error}</div>
        )}
      </div>
    </div>
  );
}
