import Image from "next/image";
import Link from "next/link";

const TILES = [
  { label: "Everyday Carry", href: "/collections/bags", seed: "Everyday Carry" },
  { label: "Stack & Layer", href: "/collections/jewellery", seed: "Stack and Layer" },
  { label: "Sunny Side", href: "/collections/jewellery", seed: "Sunny Side" },
];

/** 2-3 tile lifestyle/editorial grid linking to curated collections. */
export function EditorialTiles() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TILES.map((tile) => (
          <Link key={tile.label} href={tile.href} className="group relative block overflow-hidden">
            <div className="relative aspect-[3/4] w-full">
              <Image
                src={`https://placehold.co/800x1000/e8dfd2/1a1a1a?text=${encodeURIComponent(tile.seed)}`}
                alt={tile.label}
                fill
                sizes="(min-width: 640px) 33vw, 100vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <p className="mt-2 text-sm font-medium text-neutral-900">{tile.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
