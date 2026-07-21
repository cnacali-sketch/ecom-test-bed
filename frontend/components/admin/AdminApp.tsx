"use client";

// Admin console shell: top bar, sidebar nav, view switch, toast.
//
// Products are SEEDED from the live backend (GET /api/products) on mount, so
// the console reflects real catalogue data. Create (POST) and delete (DELETE)
// hit real endpoints; edits to an existing product are held locally for now
// because the backend has no product-update route yet (see handoff).

import {
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
  Package,
  Settings,
  Sparkles,
  ShoppingBag,
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
  type AdminSection,
  type AdminView,
  type MediaItem,
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

const SEED_CATEGORIES: AdminCategory[] = [
  { id: "c1", name: "Scrunchies", parent: "Hair Accessories", slug: "scrunchies", image: "" },
  { id: "c2", name: "Claw Clips", parent: "Hair Accessories", slug: "claw-clips", image: "" },
  { id: "c3", name: "Earrings", parent: "Jewellery", slug: "earrings", image: "" },
  { id: "c4", name: "Necklaces", parent: "Jewellery", slug: "necklaces", image: "" },
  { id: "c5", name: "Bracelets", parent: "Jewellery", slug: "bracelets", image: "" },
  { id: "c6", name: "Chokers", parent: "Bridal", slug: "chokers", image: "" },
];

const SEED_SECTIONS: AdminSection[] = [
  { id: "s1", type: "announcement", on: true, text: "Free shipping on orders over ₹999 · COD available" },
  { id: "s2", type: "hero", on: true, heading: "Teal, gold, everything gorgeous", sub: "Handpicked accessories from ₹179.", ctaLabel: "Shop the collection", image: "" },
  { id: "s3", type: "trust", on: true },
  { id: "s4", type: "categories", on: true, heading: "Shop by category" },
  { id: "s5", type: "featured", on: true, heading: "Featured this week" },
  { id: "s6", type: "grid", on: true, heading: "All jewellery & accessories" },
];

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
    featured: false,
    show: defShow(),
    stockMode: "hidden",
    dims: { h: "", w: "", l: "", unit: "cm" },
    badge: defBadge(),
  };
}

export function AdminApp() {
  const { user, logout } = useAuth();

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>(SEED_CATEGORIES);
  const [sections, setSections] = useState<AdminSection[]>(SEED_SECTIONS);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [view, setView] = useState<AdminView>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdminProduct | null>(null);
  const [toast, setToast] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Seed from the live catalogue once.
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/products")
      .then(async (res) => {
        if (cancelled || !res?.ok) return;
        const data = (await res.json()) as BackendProduct[];
        if (Array.isArray(data)) setProducts(data.map(toAdmin));
      })
      .catch(() => {});
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

  const lowCount = useMemo(
    () => products.filter((p) => p.stock <= LOW_STOCK && p.published).length,
    [products],
  );

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
      <NavBtn id="categories" icon={FolderTree} label="Categories" />
      <NavBtn id="media" icon={Images} label="Media library" />
      <NavBtn id="analytics" icon={TrendingUp} label="Analytics" />
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
            <button className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-ink/5">
              <Bell className="h-4 w-4" />
              {lowCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-gold text-[9px] font-bold text-white">
                  {lowCount}
                </span>
              )}
            </button>
            <button className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-ink/5">
              <Settings className="h-4 w-4" />
            </button>
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

          {view === "dashboard" && <Dashboard products={products} />}
          {view === "home" && <SectionEditor sections={sections} setSections={setSections} />}
          {view === "products" && <ProductList products={products} onOpen={openProduct} onNew={newProduct} />}
          {view === "editor" && draft && (
            <ProductEditor
              draft={draft}
              setDraft={setDraft}
              onSave={save}
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
            />
          )}
          {view === "categories" && (
            <CategoryManager categories={categories} setCategories={setCategories} products={products} />
          )}
          {view === "media" && <MediaLibrary media={media} setMedia={setMedia} />}
          {view === "orders" && <Orders />}
          {view === "customers" && <Customers />}
          {view === "analytics" && <Analytics />}
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
