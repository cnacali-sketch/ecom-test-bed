"use client";

// Admin console shell: top bar, sidebar nav, view switch, toast.
//
// Products/categories are SEEDED from the live backend on mount, so the
// console reflects real data. Create/update/delete all hit real endpoints.

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  CircleCheck,
  Eye,
  FolderTree,
  Home,
  Images,
  LayoutGrid,
  LogOut,
  Mail,
  Package,
  ShieldAlert,
  Sparkles,
  ShoppingBag,
  Ticket,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { toAdmin, toBackendPayload } from "@/lib/admin/adapt";
import {
  defBadge,
  defShow,
  LOW_STOCK,
  type AdminCategory,
  type AdminProduct,
  type AdminView,
} from "@/lib/admin/types";
import { uid } from "@/lib/admin/helpers";
import { apiFetch } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { BackendProduct } from "@/lib/backend-adapter";

import { Dashboard } from "./screens/Dashboard";
import { SectionEditor } from "./screens/SectionEditor";
import { ProductList } from "./screens/ProductList";
import { ProductEditor } from "./screens/ProductEditor";
import { Inventory } from "./screens/Inventory";
import { CategoryManager } from "./screens/CategoryManager";
import { MediaLibrary } from "./screens/MediaLibrary";
import { Orders } from "./screens/Orders";
import { Customers } from "./screens/Customers";
import { Analytics } from "./screens/Analytics";
import { Coupons } from "./screens/Coupons";
import { Fraud } from "./screens/Fraud";
import { ErrorLogs } from "./screens/ErrorLogs";
import { Messages } from "./screens/Messages";

// An order still "pending" (no status change at all) past this age is
// flagged as unattended — long enough to not fire on normal same-day
// processing, short enough that a genuinely missed order gets caught.
const STALE_ORDER_HOURS = 24;

/** Where a mount-time fetch got to. "error" is distinct from "ready with zero
 * rows": an empty catalogue and an unreachable backend look identical in the
 * UI otherwise, and the screens below say very different things about each. */
export type LoadState = "loading" | "ready" | "error";

/** The slice of GET /api/orders/all this shell reads. The Orders screen
 * fetches the full shape separately for its own interactivity; this is only
 * what the notification bell and the Dashboard stats need. */
export interface AdminOrderSummary {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_amount: string;
  flagged: boolean;
  flag_reason: string | null;
  created_at: string;
}

/** One phrasing for every failed admin load, so a dead backend, an expired
 * session and a 500 each read as themselves instead of as "no results". */
function loadFailureMessage(res: Response | null): string {
  if (!res) return "Couldn't reach the server — showing whatever loaded before it went away.";
  if (res.status === 401 || res.status === 403)
    return "Your admin session has expired. Please log out and log back in.";
  return `The server returned an error (HTTP ${res.status}). This screen may be incomplete.`;
}

function newDraft(): AdminProduct {
  return {
    id: `local-${uid()}`,
    sku: "",
    slug: "",
    isLocalOnly: true,
    name: "",
    category: "",
    price: 0,
    mrp: 0,
    cost: 0,
    stock: 0,
    maxPerOrder: "",
    desc: "",
    image: "",
    published: false,
    isNew: false,
    show: defShow(),
    stockMode: "hidden",
    dims: { h: "", w: "", l: "", unit: "cm" },
    badge: defBadge(),
  };
}

export function AdminApp() {
  const { user, logout } = useAuth();

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [view, setView] = useState<AdminView>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminProduct | null>(null);
  const [toast, setToast] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [flaggedOrders, setFlaggedOrders] = useState<{ id: string; user_id: string; flag_reason: string | null }[]>([]);
  const [pendingReturns, setPendingReturns] = useState<{ id: string; order_id: string; reason: string }[]>([]);
  const [staleOrders, setStaleOrders] = useState<{ id: string; user_id: string; created_at: string }[]>([]);
  // Set when a notification is clicked for a specific order, so the Orders
  // screen (which owns its own order list + expand state) opens that exact
  // order instead of just landing on the unfiltered list.
  const [ordersDeepLinkId, setOrdersDeepLinkId] = useState<string | null>(null);
  // Mount-load health. Without these a dead backend renders an admin that
  // looks like an empty shop: no products, no categories, a zero notification
  // badge, and not one word saying anything went wrong.
  const [productsState, setProductsState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifError, setNotifError] = useState(false);
  // Real orders behind the Dashboard's revenue/orders tiles. Same single
  // fetch as the notification bell -- no extra request.
  const [ordersForStats, setOrdersForStats] = useState<AdminOrderSummary[]>([]);
  const [ordersState, setOrdersState] = useState<LoadState>("loading");

  // First failure wins: the follow-on messages from the same dead backend are
  // the same message, and stacking them adds noise, not information.
  const reportLoadFailure = (res: Response | null) =>
    setLoadError((cur) => cur ?? loadFailureMessage(res));

  // Seed from the live catalogue once. limit=200 (the backend's max) --
  // without it the default limit=48 silently truncates the admin's product
  // list once the catalogue grows past that (the storefront fetch in
  // lib/api.ts already passes this; this one was the one inconsistent gap).
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/products?limit=200")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) {
          setProductsState("error");
          reportLoadFailure(res);
          return;
        }
        const data = (await res.json()) as BackendProduct[];
        if (Array.isArray(data)) setProducts(data.map(toAdmin));
        setProductsState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setProductsState("error");
        reportLoadFailure(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/categories")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) return reportLoadFailure(res);
        const data = (await res.json()) as AdminCategory[];
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => !cancelled && reportLoadFailure(null));
    return () => {
      cancelled = true;
    };
  }, []);

  // Powers the notification bell: real signals from data the console already
  // needs elsewhere (Orders/Fraud screens re-fetch their own copies for
  // per-screen interactivity — this is just a lightweight summary count).
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/orders/all")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) {
          setOrdersState("error");
          return setNotifError(true);
        }
        const data = (await res.json()) as AdminOrderSummary[];
        if (!Array.isArray(data)) {
          setOrdersState("error");
          return setNotifError(true);
        }
        setOrdersForStats(data);
        setOrdersState("ready");
        setFlaggedOrders(data.filter((o) => o.flagged));
        // "Unattended": still pending (no status change since it came in)
        // and older than the threshold — an order sitting untouched this
        // long usually means it was missed, not that it's just early.
        const staleCutoff = Date.now() - STALE_ORDER_HOURS * 60 * 60 * 1000;
        setStaleOrders(
          data.filter((o) => o.status === "pending" && new Date(o.created_at).getTime() < staleCutoff),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setOrdersState("error");
        setNotifError(true);
      });
    apiFetch("/api/returns")
      .then(async (res) => {
        if (cancelled) return;
        if (!res?.ok) return setNotifError(true);
        const data = (await res.json()) as { id: string; order_id: string; reason: string; status: string }[];
        if (Array.isArray(data)) setPendingReturns(data.filter((r) => r.status === "pending"));
      })
      .catch(() => !cancelled && setNotifError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const original = products.find((p) => p.id === selectedId) ?? null;
  const dirty = !!draft && JSON.stringify(original) !== JSON.stringify(draft);

  useEffect(() => {
    const p = products.find((x) => x.id === selectedId);
    if (p) setDraft(p);
  }, [selectedId, products]);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const openProduct = (id: string) => {
    setSelectedId(id);
    setView("editor");
  };

  const newProduct = () => {
    const p = newDraft();
    setProducts([...products, p]);
    setSelectedId(p.id);
    setView("editor");
  };

  // Persist the current draft. New products POST; existing ones PUT. Both
  // round-trip through the backend and re-adapt the response so local state
  // matches what was stored (derived slug/sku, coerced numbers, etc.).
  const save = async () => {
    if (!draft) return;
    const isNew = draft.isLocalOnly;
    const res = await apiFetch(isNew ? "/api/products" : `/api/products/${draft.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toBackendPayload(draft)),
    });
    if (res?.ok) {
      const adapted = toAdmin((await res.json()) as BackendProduct);
      setProducts((cur) => cur.map((p) => (p.id === draft.id ? adapted : p)));
      setSelectedId(adapted.id);
      flash(isNew ? "Created — added to your catalogue" : "Saved");
    } else {
      flash(res?.status === 409 ? "That SKU/slug already exists" : "Could not save to the server");
    }
  };

  // Persist one already-saved product (inventory inline edit). Local products
  // that were never created skip the network — nothing to update yet.
  const persistProduct = async (p: AdminProduct) => {
    if (p.isLocalOnly) return;
    const res = await apiFetch(`/api/products/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toBackendPayload(p)),
    });
    flash(res?.ok ? "Saved" : "Could not save that change");
  };

  // Remove a product for good. A draft that was never saved has no backend row
  // to delete -- dropping it locally is the whole operation, and previously
  // there was no way to get rid of one at all.
  const deleteProduct = async (p: AdminProduct) => {
    const label = p.name?.trim() || "this product";
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;

    const forget = () => {
      setProducts((cur) => cur.filter((x) => x.id !== p.id));
      setSelectedId(null);
      setDraft(null);
      setView("products");
    };

    if (p.isLocalOnly) {
      forget();
      flash("Draft discarded");
      return;
    }
    const res = await apiFetch(`/api/products/${p.id}`, { method: "DELETE" });
    if (res?.ok || res?.status === 204) {
      forget();
      flash("Deleted");
      return;
    }
    flash(
      res?.status === 401 || res?.status === 403
        ? "Your admin session has expired — sign in again"
        : "Could not delete that product",
    );
  };

  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock <= LOW_STOCK && p.published),
    [products],
  );
  const lowCount = lowStockProducts.length;
  const notifCount = lowCount + flaggedOrders.length + pendingReturns.length + staleOrders.length;

  const NavBtn = ({
    id,
    icon: Icon,
    label,
    badge,
  }: {
    id: AdminView;
    icon: typeof Package;
    label: string;
    badge?: number;
  }) => (
    <button
      onClick={() => {
        setView(id);
        setSidebarOpen(false);
      }}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${view === id ? "bg-teal text-white shadow-sm" : "text-ink-soft hover:bg-ink/5"}`}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${view === id ? "bg-white/20 text-white" : "bg-gold/15 text-gold"}`}>
          {badge}
        </span>
      )}
    </button>
  );

  const nav = (
    <nav className="space-y-1">
      <NavBtn id="dashboard" icon={BarChart3} label="Dashboard" />
      <NavBtn id="home" icon={Home} label="Homepage editor" />
      <NavBtn id="products" icon={Package} label="Products" />
      <NavBtn id="inventory" icon={Boxes} label="Inventory" badge={lowCount} />
      <NavBtn id="orders" icon={ShoppingBag} label="Orders" />
      <NavBtn id="customers" icon={Users} label="Customers" />
      <NavBtn id="coupons" icon={Ticket} label="Coupons" />
      <NavBtn id="categories" icon={FolderTree} label="Categories" />
      <NavBtn id="media" icon={Images} label="Media library" />
      <NavBtn id="analytics" icon={TrendingUp} label="Analytics" />
      <NavBtn id="fraud" icon={ShieldAlert} label="Fraud & abuse" />
      <NavBtn id="errorLogs" icon={AlertTriangle} label="Error logs" />
      <NavBtn id="messages" icon={Mail} label="Messages" />
    </nav>
  );

  const titles: Record<AdminView, string> = {
    dashboard: "Dashboard",
    home: "Homepage editor",
    products: "Products",
    editor: draft?.name || "New product",
    inventory: "Inventory",
    categories: "Categories",
    media: "Media library",
    orders: "Orders",
    customers: "Customers",
    analytics: "Analytics",
    coupons: "Coupons",
    fraud: "Fraud & abuse",
    errorLogs: "Error logs",
    messages: "Messages",
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* top bar */}
      <div className="sticky top-0 z-30 border-b border-gold/15 bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-ink hover:bg-ink/5 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <LayoutGrid className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal to-teal-deep text-white">
                <Sparkles className="h-4 w-4 text-gold" />
              </div>
              <div>
                <div className="font-display text-sm font-bold leading-tight">Savvy in Teal</div>
                <div className="text-[9px] uppercase tracking-widest text-gold">Store manager</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-lg border border-ink/10 px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal/10 sm:flex">
              <Eye className="h-3.5 w-3.5" /> View storefront
            </Link>
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-ink/5"
              >
                <Bell className="h-4 w-4" />
                {notifCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-gold text-[9px] font-bold text-white">
                    {notifCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-ink/10 bg-card shadow-lg">
                    <div className="border-b border-ink/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
                      Notifications
                    </div>
                    {notifError && (
                      <p className="border-b border-ink/10 bg-sale/5 px-4 py-2.5 text-xs text-sale">
                        Some alerts couldn&apos;t be loaded — order and return notifications may be missing.
                      </p>
                    )}
                    {notifCount === 0 ? (
                      <p className="p-4 text-sm text-ink-soft">
                        {notifError ? "No alerts could be loaded." : "Nothing needs attention."}
                      </p>
                    ) : (
                      <div className="divide-y divide-ink/5">
                        {staleOrders.map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              setOrdersDeepLinkId(o.id);
                              setView("orders");
                              setNotifOpen(false);
                            }}
                            className="block w-full px-4 py-2.5 text-left text-xs hover:bg-ink/5"
                          >
                            <span className="font-semibold text-sale">Unattended order</span> — {o.user_id}
                            <br />
                            <span className="text-ink-soft">
                              Still pending after{" "}
                              {Math.round((Date.now() - new Date(o.created_at).getTime()) / (60 * 60 * 1000))}h — no
                              status change yet
                            </span>
                          </button>
                        ))}
                        {flaggedOrders.map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              setOrdersDeepLinkId(o.id);
                              setView("orders");
                              setNotifOpen(false);
                            }}
                            className="block w-full px-4 py-2.5 text-left text-xs hover:bg-ink/5"
                          >
                            <span className="font-semibold text-sale">Flagged order</span> — {o.user_id}
                            <br />
                            <span className="text-ink-soft">{o.flag_reason ?? "Review recommended"}</span>
                          </button>
                        ))}
                        {pendingReturns.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              setOrdersDeepLinkId(r.order_id);
                              setView("orders");
                              setNotifOpen(false);
                            }}
                            className="block w-full px-4 py-2.5 text-left text-xs hover:bg-ink/5"
                          >
                            <span className="font-semibold text-gold">Return requested</span>
                            <br />
                            <span className="text-ink-soft">{r.reason}</span>
                          </button>
                        ))}
                        {lowStockProducts.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => {
                              openProduct(p.id);
                              setNotifOpen(false);
                            }}
                            className="block w-full px-4 py-2.5 text-left text-xs hover:bg-ink/5"
                          >
                            <span className="font-semibold text-teal">Low stock</span> — {p.name}
                            <br />
                            <span className="text-ink-soft">{p.stock} left</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="ml-1 flex items-center gap-2 rounded-full bg-teal/10 pl-1 pr-3">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-teal text-xs font-bold text-white">
                {(user?.email?.[0] ?? "A").toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold leading-tight">{user?.email ?? "Admin"}</div>
                <div className="text-[10px] text-ink-soft">Owner</div>
              </div>
            </div>
            <button onClick={() => logout()} title="Sign out" className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-ink/5">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1400px] gap-6 p-4 sm:p-6">
        <aside className="hidden w-56 shrink-0 lg:block">{nav}</aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div onClick={() => setSidebarOpen(false)} className="absolute inset-0 bg-ink/50" />
            <div className="absolute left-0 top-0 h-full w-64 bg-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-bold">Menu</span>
                <button onClick={() => setSidebarOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-ink/5">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {nav}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <header className="mb-5">
            <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{titles[view]}</h1>
          </header>

          {loadError && (
            <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-sale/30 bg-sale/5 px-4 py-3 text-xs text-sale">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => setLoadError(null)}
                className="shrink-0 font-semibold uppercase tracking-wide hover:underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {view === "dashboard" && (
            <Dashboard products={products} orders={ordersForStats} ordersState={ordersState} />
          )}
          {view === "home" && <SectionEditor />}
          {view === "products" && (
            <ProductList
              products={products}
              onOpen={openProduct}
              onNew={newProduct}
              loadState={productsState}
            />
          )}
          {view === "editor" && draft && (
            <ProductEditor
              draft={draft}
              setDraft={setDraft}
              onSave={save}
              onDelete={() => deleteProduct(draft)}
              onReset={() => original && setDraft(original)}
              dirty={dirty}
              products={products}
              categories={categories}
            />
          )}
          {view === "inventory" && (
            <Inventory
              products={products}
              setProducts={setProducts}
              onPersist={persistProduct}
              onOpen={openProduct}
              categories={categories}
              loadState={productsState}
            />
          )}
          {view === "categories" && (
            <CategoryManager categories={categories} setCategories={setCategories} products={products} />
          )}
          {view === "media" && <MediaLibrary />}
          {view === "orders" && (
            <Orders deepLinkOrderId={ordersDeepLinkId} onDeepLinkConsumed={() => setOrdersDeepLinkId(null)} />
          )}
          {view === "customers" && <Customers />}
          {view === "analytics" && <Analytics />}
          {view === "coupons" && <Coupons />}
          {view === "fraud" && <Fraud />}
          {view === "errorLogs" && <ErrorLogs />}
          {view === "messages" && <Messages />}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-xl">
          <CircleCheck className="h-4 w-4 text-teal" /> {toast}
        </div>
      )}
    </div>
  );
}
