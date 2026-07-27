"use client";

// Client-side image picker. Enforces an exact square (1000×1000) so the shop
// grid stays uniform, then uploads to /api/media and stores the returned URL.
//
// Storing the URL rather than a base64 data URL matters a lot: a data URL is
// ~33% bigger than the file, gets written into the DB row, and is then
// inlined into the HTML of every page that renders it. One 2 MB photo saved
// this way made the homepage a 5.4 MB document (measured live) — the URL is
// ~40 bytes and the browser caches the image separately.

import { AlertTriangle, CheckCircle2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { fmtSize } from "@/lib/admin/helpers";
import { REQ_IMG } from "@/lib/admin/types";
import { apiBaseUrl, apiFetch } from "@/lib/api-client";
import { HelpTip } from "./atoms";

interface Meta {
  name: string;
  size: number;
  w: number;
  h: number;
}

export function ImageDrop({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
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
    } finally {
      setUploading(false);
    }
  }

  const handle = (fileList: FileList | null) => {
    setErr("");
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("That file isn't an image.");
      return;
    }
    // Read only to measure dimensions — the file itself is what gets
    // uploaded, never this data URL.
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if (img.naturalWidth !== REQ_IMG.w || img.naturalHeight !== REQ_IMG.h) {
        setErr(
          `Your photo is ${img.naturalWidth} × ${img.naturalHeight} px. Must be exactly ${REQ_IMG.w} × ${REQ_IMG.h} px.`,
        );
        return;
      }
      if (file.size > REQ_IMG.maxMB * 1048576) {
        setErr(`Photo is ${fmtSize(file.size)}. Must be under ${REQ_IMG.maxMB} MB.`);
        return;
      }
      setMeta({ name: file.name, size: file.size, w: img.naturalWidth, h: img.naturalHeight });
      upload(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErr("Couldn't read that image.");
    };
    img.src = objectUrl;
  };

  return (
    <div>
      {!compact && (
        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
          Product photo{" "}
          <HelpTip text="Every photo must be the same shape so your shop grid stays neat." />
          <span className="ml-auto rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
            Square · exactly {REQ_IMG.w}×{REQ_IMG.h} · ≤{REQ_IMG.maxMB} MB
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
              <div className="mt-0.5 truncate text-xs text-ink-soft">
                {meta.name} · {meta.w}×{meta.h} · {fmtSize(meta.size)}
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
            {uploading ? "Uploading…" : "Drop photo or click"}
          </div>
          {!compact && (
            <div className="mt-0.5 text-xs text-ink-soft/70">
              Photos that aren&apos;t {REQ_IMG.w}×{REQ_IMG.h} px are rejected automatically
            </div>
          )}
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
