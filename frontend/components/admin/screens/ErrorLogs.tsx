"use client";

// Error log viewer: what the backend's ErrorLoggingMiddleware captured —
// 500s (server crashes, full traceback) and 401/403 (auth/permission
// denials, e.g. the CSRF-cookie-domain bug this screen exists to make
// visible without needing SSH access to raw container logs).

import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

interface ErrorLogEntry {
  id: string;
  status_code: number;
  method: string;
  path: string;
  message: string;
  detail: string | null;
  created_at: string;
}

function statusStyle(status: number): string {
  if (status >= 500) return "bg-sale/10 text-sale";
  if (status === 403) return "bg-gold/15 text-gold";
  return "bg-ink/10 text-ink-soft";
}

export function ErrorLogs() {
  const [logs, setLogs] = useState<ErrorLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch("/api/error-logs")
      .then(async (res) => {
        if (!res?.ok) return setError(true);
        setLogs((await res.json()) as ErrorLogEntry[]);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function clearAll() {
    if (!confirm("Clear all error log entries?")) return;
    const res = await apiFetch("/api/error-logs", { method: "DELETE" });
    if (res?.ok || res?.status === 204) {
      setLogs([]);
      setActionError(null);
      return;
    }
    // Without this the button just does nothing and the list stays put.
    setActionError(
      res && (res.status === 401 || res.status === 403)
        ? "Your admin session has expired. Please log out and log back in."
        : "Couldn't clear the error log. Please try again.",
    );
  }

  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading error logs…</p>;
  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load error logs. Check you&apos;re signed in as an admin.</p>;

  return (
    <div className="rounded-2xl border border-ink/10 bg-card shadow-sm">
      {actionError && (
        <div className="flex items-center justify-between gap-3 border-b border-sale/30 bg-sale/5 px-5 py-3 text-xs text-sale">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="font-semibold uppercase tracking-wide hover:underline">
            Dismiss
          </button>
        </div>
      )}
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <AlertTriangle className="h-4 w-4 text-sale" /> Error logs ({logs.length})
        </h3>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-ink/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear all
          </button>
        )}
      </div>
      {logs.length === 0 ? (
        <p className="p-8 text-center text-sm text-ink-soft">
          No errors captured. This fills in when something actually fails — 500s and 401/403 denials.
        </p>
      ) : (
        <div className="divide-y divide-ink/5">
          {logs.map((log) => {
            const expanded = expandedId === log.id;
            return (
              <div key={log.id} className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="flex w-full items-center gap-3 text-left"
                  disabled={!log.detail}
                >
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${statusStyle(log.status_code)}`}>
                    {log.status_code}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-ink-soft">{log.method}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{log.path}</span>
                  <span className="shrink-0 text-xs text-ink-soft">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </button>
                <p className="mt-1 pl-[3.75rem] text-xs text-ink-soft">{log.message}</p>
                {expanded && log.detail && (
                  <pre className="mt-2 ml-[3.75rem] max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-ink/5 p-3 text-[11px] text-ink-soft">
                    {log.detail}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
