import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { fetchHomepageContent } from "@/lib/api";

/**
 * Signature hero: oversized italic serif accent word overlapping a
 * full-height editorial photograph that bleeds to the viewport edge.
 * Copy/images come from content/site.config.ts by default, per-field
 * overridden by the admin Homepage editor (GET /api/sections) when set.
 */
export async function HeroBanner() {
  const defaults = siteConfig.home.hero;
  const override = await fetchHomepageContent();
  const hero = {
    accentWord: override?.hero_accent_word || defaults.accentWord,
    headline: override?.hero_headline || defaults.headline,
    subline: override?.hero_subline || defaults.subline,
    ctaLabel: override?.hero_cta_label || defaults.ctaLabel,
    ctaHref: override?.hero_cta_href || defaults.ctaHref,
    image: override?.hero_image || defaults.image,
    imageAlt: override?.hero_image_alt || defaults.imageAlt,
    secondaryImage: defaults.secondaryImage,
    secondaryImageAlt: defaults.secondaryImageAlt,
  };

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
        {/* Copy column */}
        <div className="relative z-10 order-2 flex flex-col justify-center px-4 py-10 sm:px-8 lg:order-1 lg:py-24 lg:pl-12 lg:pr-0">
          <p className="eyebrow animate-rise flex items-center gap-3">
            <span aria-hidden className="h-px w-10 bg-gold" />
            New drop
          </p>
          <h1 className="mt-4 text-ink">
            <span className="font-display animate-rise delay-1 block text-[clamp(4.5rem,12vw,9.5rem)] italic leading-[0.85] tracking-tight text-teal lg:-mr-24">
              {hero.accentWord}
            </span>
            <span className="animate-rise delay-2 mt-3 block text-xl uppercase tracking-[0.12em] sm:text-2xl lg:text-3xl">
              {hero.headline}
            </span>
          </h1>
          <p className="animate-rise delay-2 mt-6 max-w-sm text-[15px] leading-relaxed text-ink-soft">
            {hero.subline}
          </p>
          <div className="animate-rise delay-3 mt-9 flex flex-col items-stretch gap-6 sm:flex-row sm:items-center">
            <Link
              href={hero.ctaHref}
              className="inline-block w-full bg-teal px-9 py-4 text-center text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-teal-deep sm:w-auto"
            >
              {hero.ctaLabel}
            </Link>
            <span aria-hidden className="font-display hidden text-2xl italic text-gold sm:block">✿</span>
          </div>

          <div className="animate-fade delay-3 relative mt-12 hidden aspect-[4/3] w-52 self-start border border-ink/10 lg:block">
            <Image
              src={hero.secondaryImage}
              alt={hero.secondaryImageAlt}
              fill
              sizes="208px"
              className="object-cover"
            />
          </div>
        </div>

        {/* Image column — bleeds to viewport edge on desktop */}
        <div className="animate-fade relative order-1 aspect-[4/5] w-full bg-paper-tint lg:order-2 lg:aspect-auto lg:min-h-[82vh]">
          <Image
            src={hero.image}
            alt={hero.imageAlt}
            fill
            priority
            sizes="(min-width: 1024px) 56vw, 100vw"
            className="object-cover"
          />
          <div aria-hidden className="absolute bottom-6 left-6 hidden border border-white/50 px-4 py-2 text-[10px] uppercase tracking-[0.22em] text-white lg:block">
            {siteConfig.brand.tagline}
          </div>
        </div>
      </div>
    </section>
  );
}
