import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { fetchHomepageContent } from "@/lib/api";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Editorial story tiles — image + eyebrow + serif title + copy.
 * The middle tile is offset downward on desktop (staggered shelf).
 * Whole-list override from the admin Homepage editor when set.
 */
export async function EditorialTiles() {
  const override = await fetchHomepageContent();
  const tiles = override?.editorial_tiles?.length ? override.editorial_tiles : siteConfig.home.editorialTiles;

  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        {tiles.map((tile, index) => (
          <Reveal key={tile.title} delay={index * 90} className={index === 1 ? "md:mt-12" : ""}>
            <Link href={tile.href} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-paper-tint">
                <Image
                  src={tile.image}
                  alt={tile.imageAlt}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              </div>
              <p className="eyebrow mt-4">{tile.eyebrow}</p>
              <h3 className="font-display mt-1 text-2xl italic text-ink transition-colors group-hover:text-teal">
                {tile.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{tile.copy}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
