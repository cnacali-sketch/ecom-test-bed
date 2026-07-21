"use client";

// Bulk photo library. LOCAL-ONLY — images are held in browser state as base64
// data URLs (no upload endpoint yet), so nothing here persists across reloads.

import { AlertTriangle, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";

import { uid } from "@/lib/admin/helpers";
import { REQ_IMG, type MediaItem } from "@/lib/admin/types";

export function MediaLibrary({
  media,
  setMedia,
}: {
  media: MediaItem[];
  setMedia: (updater: (m: MediaItem[]) => MediaItem[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);

  const add = (files: FileList | null) => {
    setErr("");
    const list = Array.from(files ?? []);
    if (!list.length) return;
    list.forEach((f) => {
      if (!f.type.startsWith("image/")) {
        setErr("Only images.");
        return;
      }
      const r = new FileReader();
      r.onload = (e) => {
        const url = String(e.target?.result ?? "");
        const img = new Image();
        img.onload = () => {
          if (img.naturalWidth !== REQ_IMG.w || img.naturalHeight !== REQ_IMG.h) {
            setErr(`Skipped ${f.name} — must be ${REQ_IMG.w}×${REQ_IMG.h}px.`);
            return;
          }
          setMedia((m) => [{ id: `m-${uid()}`, name: f.name, url, size: f.size }, ...m]);
        };
        img.src = url;
      };
      r.readAsDataURL(f);
    });
  };

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink">Media library</h2>
        <p className="text-sm text-ink-soft">
          Drop many photos at once.{" "}
          <span className="font-semibold text-gold">Local only — held in this browser, not uploaded.</span>
        </p>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 text-center transition ${drag ? "border-teal bg-teal/5" : "border-ink/20 hover:bg-ink/[0.02]"}`}
      >
        <UploadCloud className="mb-2 h-8 w-8 text-ink-soft/60" />
        <div className="text-sm font-semibold text-ink">Drop photos or click to upload</div>
        <div className="text-xs text-ink-soft/70">
          Exactly {REQ_IMG.w}×{REQ_IMG.h}px each · ≤{REQ_IMG.maxMB}MB · {media.length} in library
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => add(e.target.files)}
        />
      </div>
      {err && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-sale/5 px-3 py-2 text-xs text-sale">
          <AlertTriangle className="h-3.5 w-3.5" /> {err}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {media.map((m) => (
          <div
            key={m.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-ink/10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.name} className="h-full w-full object-cover" />
            <button
              onClick={() => setMedia((cur) => cur.filter((x) => x.id !== m.id))}
              className="absolute right-1 top-1 hidden rounded-full bg-card/95 p-1 group-hover:block"
            >
              <Trash2 className="h-3.5 w-3.5 text-sale" />
            </button>
          </div>
        ))}
        {media.length === 0 && (
          <div className="col-span-full py-10 text-center text-sm text-ink-soft/70">No photos yet.</div>
        )}
      </div>
    </div>
  );
}
