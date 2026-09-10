"use client";

// Bulk photo library. Backed by POST/GET/DELETE /api/media (see
// backend/app/routers/media.py) — files persist to disk on the server and
// are served back at their returned `url`, so uploads survive a refresh.

import { AlertTriangle, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { apiBaseUrl, apiFetch } from "@/lib/api-client";
import { IMG_SPECS, MEDIA_MAX_KB, type MediaItem } from "@/lib/admin/types";
import { prepareImage } from "@/lib/image-prepare";

export function MediaLibrary() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch("/api/media")
      .then(async (res) => {
        // A failed load used to fall through to the same empty grid an actually
        // empty library shows -- silently, with no way to tell them apart.
        if (!res?.ok) {
          setErr(
            res && (res.status === 401 || res.status === 403)
              ? "Your admin session has expired. Please log out and log back in."
              : "Couldn't load the media library. It may not be empty — try reloading.",
          );
          return;
        }
        setMedia((await res.json()) as MediaItem[]);
      })
      .catch(() => setErr("Couldn't reach the server to load the media library."))
      .finally(() => setLoading(false));
  }, []);

  async function add(files: FileList | null) {
    setErr("");
    const incoming = Array.from(files ?? []);
    let done = 0;
    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        setErr("Only images.");
        continue;
      }

      setBusy(`Preparing ${file.name} (${done + 1} of ${incoming.length})…`);
      // Compress rather than reject. A phone photo is several megabytes, and
      // the old rule bounced it with advice ("save it as WebP") that cannot
      // be followed on a phone. No aspect-ratio rule here: this is a shared
      // pool, so the right shape depends on which slot ends up using it.
      let prepared;
      try {
        prepared = await prepareImage(file, {
          maxWidth: IMG_SPECS.hero.w,
          maxHeight: IMG_SPECS.hero.h,
          maxBytes: MEDIA_MAX_KB * 1024,
        });
      } catch {
        setErr(`Skipped ${file.name} — couldn't read it as an image.`);
        continue;
      }

      setBusy(`Uploading ${file.name} (${done + 1} of ${incoming.length})…`);
      const form = new FormData();
      form.append("file", prepared.file);
      const res = await apiFetch("/api/media", { method: "POST", body: form });
      if (!res?.ok) {
        const body = await res?.json().catch(() => null);
        setErr(body?.detail ?? `Couldn't upload ${file.name}.`);
        continue;
      }
      const uploaded = (await res.json()) as MediaItem;
      setMedia((m) => [uploaded, ...m]);
      done += 1;
    }
    setBusy("");
  }

  async function remove(id: string) {
    const res = await apiFetch(`/api/media/${id}`, { method: "DELETE" });
    if (res?.ok || res?.status === 204) {
      setMedia((cur) => cur.filter((x) => x.id !== id));
    } else {
      setErr("Couldn't delete that file. Please try again.");
    }
  }

  const base = apiBaseUrl() ?? "";

  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading media library…</p>;

  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-ink">Media library</h2>
        <p className="text-sm text-ink-soft">Drop many photos at once.</p>
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
          Any size — converted and compressed for you · {media.length} in library
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
      {busy && (
        <p className="mb-3 rounded-lg bg-teal/10 px-3 py-2 text-xs font-medium text-teal">{busy}</p>
      )}
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
            <img src={`${base}${m.url}`} alt={m.name} className="h-full w-full object-cover" />
            <button
              onClick={() => remove(m.id)}
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
