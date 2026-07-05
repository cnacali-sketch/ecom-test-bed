import Link from "next/link";

const CTA_TILES = [
  { label: "Clearance Sale", href: "/collections/bags" },
  { label: "Gifts Under 999", href: "/collections/jewellery" },
  { label: "Shop Jewellery", href: "/collections/jewellery" },
  { label: "Shop All", href: "/collections/bags" },
];

/** 3-4 promo tile row (Accessorize pattern). */
export function QuickCtaRow() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CTA_TILES.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="flex items-center justify-center rounded border border-neutral-200 px-4 py-6 text-center text-sm font-medium text-neutral-900 hover:border-neutral-900"
          >
            {tile.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
