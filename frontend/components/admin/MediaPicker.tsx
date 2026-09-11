"use client";

// Pick an already-uploaded photo from the media library.
//
// Without this the library was write-only: photos went in and nothing could
// use them, so building a product meant re-uploading a picture that was
// already on the server. Every image slot in the admin now offers both —
// upload a new photo, or reuse one that is already there.

import { AlertTriangle, ImageIcon, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { fmtSize } from "@/lib/admin/helpers";
import { apiBaseUrl, apiFetch } from "@/lib/api-client";

export interface MediaItem {
  id: string;
  name: string;
  url: string;
  size: number;
}

export function MediaPicker({
  slotLabel,
  onPick,
  onClose,
}: {
  /** Named so the owner knows which slot they are filling. */
  slotLabel: string;
  onPick: (url: string) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const base = apiBaseUrl() ?? "";

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/media")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) {
          setErr(
            res?.status === 401 || res?.status === 403
              ? "Your admin session has expired. Log out and back in."
              : "Couldn't load the media library.",
          );
          return;
        }
        setItems((await res.json()) as MediaItem[]);
      })
      .catch(() => !cancelled && setErr("Couldn't reach the server."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes, matching the crop editor and every other admin dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const term = query.trim().toLowerCase();
  const shown = term ? items.filter((m) => m.name.toLowerCase().includes(term)) : items;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a photo for ${slotLabel}`}
      >
        <div className="flex items-center gap-3 border-b border-ink/10 px-5 py-4">
          <h3 className="text-sm font-bold text-ink">Choose a photo — {slotLabel}</h3>
          <label className="relative ml-auto">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-soft/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by file name"
              aria-label="Search the media library"
              className="w-48 rounded-lg border border-ink/15 bg-card py-1.5 pl-8 pr-2 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-ink/5 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading && <p className="py-10 text-center text-sm text-ink-soft">Loading…</p>}

          {err && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-sale">
              <AlertTriangle className="h-4 w-4" /> {err}
            </p>
          )}

          {!loading && !err && shown.length === 0 && (
            <div className="py-12 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-ink-soft/40" />
              <p className="mt-3 text-sm text-ink-soft">
                {term ? `No photo matches “${term}”.` : "The media library is empty."}
              </p>
              {!term && (
                <p className="mt-1 text-xs text-ink-soft/60">
                  Upload photos here, or in Media library, and they become reusable.
                </p>
              )}
            </div>
          )}

          {!loading && !err && shown.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {shown.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  // The full absolute URL, matching exactly what a fresh upload
                  // stores — a relative one would break the storefront, which
                  // renders from a different origin than the API.
                  onClick={() => onPick(`${base}${m.url}`)}
                  title={`${m.name} · ${fmtSize(m.size)}`}
                  className="group overflow-hidden rounded-lg border border-ink/10 text-left transition hover:border-teal focus:border-teal focus:outline-none"
                >
                  <div className="aspect-square bg-paper-tint">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${base}${m.url}`}
                      alt={m.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="truncate px-2 py-1.5 text-[11px] text-ink-soft">{m.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-ink/10 px-5 py-3 text-xs text-ink-soft">
          {/* Said plainly because it is the one surprise here: library photos
              were cropped for whichever slot they were uploaded against, so
              reusing one in a differently-shaped slot re-frames it in CSS
              rather than re-cropping the file. */}
          Photos keep the shape they were uploaded with. For a different shape, upload the
          original again and crop it for this slot.
        </div>
      </div>
    </div>
  );
}
