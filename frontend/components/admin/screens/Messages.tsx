"use client";

// Messages screen: submissions from the public /contact form (query,
// grievance, complaint, business inquiry) — GET/PATCH/DELETE /api/contact,
// admin-gated. Expanding a message marks it read.

import { useEffect, useState } from "react";
import { Mail, Trash2 } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

interface ContactMessage {
  id: string;
  category: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
  ip_address: string | null;
  is_read: boolean;
  created_at: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  query: "Query",
  grievance: "Grievance",
  complaint: "Complaint",
  business_inquiry: "Business inquiry",
};

const CATEGORY_STYLE: Record<string, string> = {
  query: "bg-teal/10 text-teal",
  grievance: "bg-gold/15 text-gold",
  complaint: "bg-sale/10 text-sale",
  business_inquiry: "bg-emerald-600/10 text-emerald-700",
};

export function Messages() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    apiFetch("/api/contact")
      .then(async (res) => {
        if (!res?.ok) return setError(true);
        setMessages((await res.json()) as ContactMessage[]);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function setRead(id: string, isRead: boolean) {
    const res = await apiFetch(`/api/contact/${id}?is_read=${isRead}`, { method: "PATCH" });
    if (res?.ok) {
      const updated = (await res.json()) as ContactMessage;
      setMessages((cur) => cur.map((m) => (m.id === id ? updated : m)));
    }
  }

  function toggleExpand(m: ContactMessage) {
    const expanding = expandedId !== m.id;
    setExpandedId(expanding ? m.id : null);
    if (expanding && !m.is_read) setRead(m.id, true);
  }

  async function deleteMessage(id: string) {
    if (!confirm("Delete this message?")) return;
    const res = await apiFetch(`/api/contact/${id}`, { method: "DELETE" });
    if (res?.ok || res?.status === 204) {
      setMessages((cur) => cur.filter((m) => m.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  }

  const unreadCount = messages.filter((m) => !m.is_read).length;

  if (loading) return <p className="p-8 text-sm text-ink-soft">Loading messages…</p>;
  if (error)
    return <p className="p-8 text-sm text-sale">Couldn&apos;t load messages. Check you&apos;re signed in as an admin.</p>;

  return (
    <div className="rounded-2xl border border-ink/10 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <Mail className="h-4 w-4 text-teal" /> Messages ({messages.length})
          {unreadCount > 0 && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
              {unreadCount} unread
            </span>
          )}
        </h3>
      </div>
      {messages.length === 0 ? (
        <p className="p-8 text-center text-sm text-ink-soft">
          No messages yet. Submissions from the storefront Contact page show up here.
        </p>
      ) : (
        <div className="divide-y divide-ink/5">
          {messages.map((m) => {
            const expanded = expandedId === m.id;
            return (
              <div key={m.id} className={`px-5 py-3 ${!m.is_read ? "bg-teal/5" : ""}`}>
                <button type="button" onClick={() => toggleExpand(m)} className="flex w-full items-start gap-3 text-left">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${CATEGORY_STYLE[m.category] ?? "bg-ink/10 text-ink-soft"}`}>
                    {CATEGORY_LABEL[m.category] ?? m.category}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${!m.is_read ? "font-semibold text-ink" : "text-ink"}`}>{m.name}</span>
                    <span className="block truncate text-xs text-ink-soft">{m.message}</span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-soft">{new Date(m.created_at).toLocaleString()}</span>
                </button>
                {expanded && (
                  <div className="mt-3 pl-[4.5rem]">
                    <p className="whitespace-pre-wrap text-sm text-ink">{m.message}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
                      {m.email && (
                        <a href={`mailto:${m.email}`} className="text-teal underline-offset-2 hover:underline">
                          {m.email}
                        </a>
                      )}
                      {m.phone && (
                        <a href={`tel:${m.phone}`} className="text-teal underline-offset-2 hover:underline">
                          {m.phone}
                        </a>
                      )}
                      {m.ip_address && <span className="font-mono text-ink-soft/70">{m.ip_address}</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRead(m.id, !m.is_read)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-ink/5"
                      >
                        Mark as {m.is_read ? "unread" : "read"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMessage(m.id)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-sale/5 hover:text-sale"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
