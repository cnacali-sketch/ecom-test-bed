"use client";

// Shared admin form atoms. Styled with the storefront's token palette
// (--ink / --teal / --gold / --sale) rather than raw hex, so the admin and
// the shop read as one system.

import { AlertTriangle, Eye, EyeOff, HelpCircle, Zap } from "lucide-react";
import { useState } from "react";

import { hexToRgba } from "@/lib/admin/helpers";
import type { BadgeAnimation } from "@/lib/types";

export const inputCls =
  "w-full rounded-lg border border-ink/15 bg-card px-3 py-2 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15";

export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <HelpCircle className="h-3.5 w-3.5 cursor-help text-ink-soft/60 transition-colors hover:text-teal" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-56 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs leading-relaxed text-white opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-1.5 text-xs font-semibold"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-teal" : "bg-ink/20"}`}>
        <span
          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`}
        />
      </span>
      {label && <span className={on ? "text-ink-soft" : "text-ink-soft/60"}>{label}</span>}
    </button>
  );
}

export function ShowToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="ml-auto flex items-center gap-1 text-ink-soft/60">
      {on ? <Eye className="h-3.5 w-3.5 text-teal" /> : <EyeOff className="h-3.5 w-3.5" />}
      <Toggle on={on} onChange={onChange} label={on ? "Shown" : "Hidden"} />
    </span>
  );
}

export function Field({
  label,
  help,
  required,
  right,
  error,
  children,
}: {
  label: string;
  help?: string;
  required?: boolean;
  right?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-sale">*</span>}
        {help && <HelpTip text={help} />}
        {right && <span className="ml-auto flex items-center">{right}</span>}
      </span>
      {children}
      {error && (
        <span className="mt-1 flex items-center gap-1 text-xs font-medium text-sale">
          <AlertTriangle className="h-3 w-3" />
          {error}
        </span>
      )}
    </label>
  );
}

export function DiscountBadge({
  text,
  anim = "shine",
  bg = "#f59e0b",
  fg = "#fff",
  opacity = 100,
  className = "",
}: {
  text: string;
  anim?: BadgeAnimation;
  bg?: string;
  fg?: string;
  opacity?: number;
  className?: string;
}) {
  // Reuse the storefront's badge keyframes (app/globals.css).
  const a =
    anim === "pulse"
      ? "badge-anim-pulse"
      : anim === "wiggle"
        ? "badge-anim-wiggle"
        : anim === "shine"
          ? "badge-anim-shine"
          : "";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shadow ${a} ${className}`}
      style={{ backgroundColor: hexToRgba(bg, opacity / 100), color: fg }}
    >
      <Zap className="h-3 w-3 fill-current" /> {text}
    </span>
  );
}

/** Minimal HTML5 drag-reorder for a list of `{id}` items. */
export function useDnd<T extends { id: string }>(list: T[], setList: (next: T[]) => void) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  return {
    dragId,
    overId,
    onDragStart: (id: string) => (e: React.DragEvent) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (id: string) => (e: React.DragEvent) => {
      e.preventDefault();
      if (id !== overId) setOverId(id);
    },
    onDrop: () => {
      if (!dragId || !overId || dragId === overId) {
        setDragId(null);
        setOverId(null);
        return;
      }
      const from = list.findIndex((x) => x.id === dragId);
      const to = list.findIndex((x) => x.id === overId);
      const next = [...list];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      setList(next);
      setDragId(null);
      setOverId(null);
    },
    onDragEnd: () => {
      setDragId(null);
      setOverId(null);
    },
  };
}
