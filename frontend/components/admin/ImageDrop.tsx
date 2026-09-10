"use client";

// Client-side image picker. Validates against the slot's ImageSpec, then
// uploads to /api/media and stores the returned URL.
//
// Two things it deliberately gets right:
//
// 1. Aspect ratio, not exact pixels. This used to demand an exact 1000×1000
//    square for every slot — but product cards, hero, campaign and editorial
//    tiles all render 4:5, so a square upload was silently centre-cropped and
//    the owner lost the top and bottom of their photo without being told.
//
// 2. Stores the URL, never a base64 data URL. A data URL is ~33% bigger than
//    the file, lands in the DB row, and gets inlined into the HTML of every
//    page that renders it. One 2 MB photo saved that way made the homepage a
//    5.4 MB document (measured live); the URL is ~40 bytes and the browser
//    caches the image separately.

import { AlertTriangle, CheckCircle2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { fmtSize } from "@/lib/admin/helpers";
import { IMG_SPECS, type ImageSpec } from "@/lib/admin/types";
import { apiBaseUrl, apiFetch } from "@/lib/api-client";
import { prepareImage } from "@/lib/image-prepare";
import { HelpTip } from "./atoms";

interface Meta {
  name: string;
  size: number;
  w: number;
  h: number;
  /** Original file size, when the photo was re-encoded on the way in. */
  fromBytes?: number;
  /** Share of the photo removed to reach the slot's shape. */
  croppedPercent?: number;
}

export function ImageDrop({
  value,
  onChange,
  compact = false,
  spec = IMG_SPECS.product,
}: {
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
  /** Which slot this picker fills — drives the aspect ratio and size limit. */
  spec?: ImageSpec;
}) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/media", { method: "POST", body: form });
      if (!res?.ok) {
        setErr("Upload failed. Please try again.");
        return;
      }
      const item = (await res.json()) as { url: string };
      onChange(`${apiBaseUrl() ?? ""}${item.url}`);
    } catch {
      setErr("Upload failed. Please try again.");
    }
  }

  // Photos are conformed to the slot rather than rejected for not matching it.
  // A portrait phone photo is 3:4 and several megabytes; this slot wants 4:5
  // under a few hundred KB, so every straight-from-camera upload used to fail
  // with no way to fix it on the phone. Cropping is reported, never silent.
  const handle = async (fileList: FileList | null) => {
    setErr("");
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("That file isn't an image.");
      return;
    }

    setUploading(true);
    try {
      const prepared = await prepareImage(file, {
        aspect: spec.w / spec.h,
        maxWidth: spec.w,
        maxHeight: spec.h,
        maxBytes: spec.maxKB * 1024,
      });
      setMeta({
        name: prepared.file.name,
        size: prepared.file.size,
        w: prepared.width,
        h: prepared.height,
        fromBytes: prepared.originalBytes,
        croppedPercent: prepared.croppedPercent,
      });
      await upload(prepared.file);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Couldn't read that image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {!compact && (
        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
          Product photo{" "}
          <HelpTip text="Every photo must be the same shape so your shop grid stays neat. Save as WebP to keep the file small — your pages load faster." />
          <span className="ml-auto rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
            {spec.shape} · {spec.w}×{spec.h} · ≤{spec.maxKB} KB
          </span>
        </div>
      )}
      {value ? (
        <div
          className={`flex items-center gap-3 rounded-xl border border-ink/10 bg-ink/[0.03] ${compact ? "p-2" : "p-3"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className={`${compact ? "h-14 w-14" : "h-20 w-20"} rounded-lg object-cover`}
          />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-teal">
              <CheckCircle2 className="h-4 w-4" /> Photo accepted
            </div>
            {meta && (
              <div className="mt-0.5 text-xs text-ink-soft">
                <div className="truncate">
                  {meta.name} · {meta.w}×{meta.h} · {fmtSize(meta.size)}
                  {meta.fromBytes != null && meta.fromBytes > meta.size && (
                    <span className="text-teal"> · from {fmtSize(meta.fromBytes)}</span>
                  )}
                </div>
                {meta.croppedPercent != null && meta.croppedPercent > 0 && (
                  <div className="text-ink-soft/70">
                    Centre-cropped to {spec.shape} — {meta.croppedPercent}% of the photo trimmed.
                    Reshoot with the product centred if that cut something off.
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => {
                onChange("");
                setMeta(null);
                setErr("");
              }}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-sale hover:underline"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            handle(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition ${drag ? "border-teal bg-teal/5" : "border-ink/20 bg-card hover:border-teal/60 hover:bg-ink/[0.02]"} ${compact ? "px-3 py-4" : "px-4 py-8"}`}
        >
          <UploadCloud
            className={`${compact ? "mb-1 h-6 w-6" : "mb-2 h-8 w-8"} ${drag ? "text-teal" : "text-ink-soft/60"}`}
          />
          <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-ink`}>
            {uploading ? "Preparing…" : "Drop photo or click"}
          </div>
          <div className={`mt-0.5 text-ink-soft/70 ${compact ? "text-[11px]" : "text-xs"}`}>
            Any size — cropped to {spec.shape} and compressed for you
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handle(e.target.files)}
          />
        </div>
      )}
      {err && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-sale/5 px-3 py-2 text-xs font-medium text-sale">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {err}
        </div>
      )}
    </div>
  );
}
