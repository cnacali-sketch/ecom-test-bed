import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { fetchHomepageContent } from "@/lib/api";

/**
 * Signature hero: two full-bleed images side by side (a diptych) with the
 * brand mark overlaid dead-centre across the seam, and a plain caption
 * below. Pairs with Header's transparent-over-hero state — see Header.tsx.
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
    imageRight: defaults.imageRight,
    imageRightAlt: defaults.imageRightAlt,
  };
  const { logo } = siteConfig.brand;

  return (
    <section className="relative">
      <div className="relative">
        {/* Brand mark overlaid dead-centre across the seam, sized by width
            to match how much of the hero it should cover (mirrors the
            now-removed design prototype's hero-logo treatment).

            .hero-masthead (globals.css) shrinks and fades it out as
            --nav-p goes 0→1 while the header's own logo grows in, so the
            mark reads as flying from the hero into the pill. That class
            owns the centring transform too, since it has to re-apply the
            translate alongside the scale.

            Not a link: this only ever renders on "/", so pointing it at
            "/" gave screen-reader users a second identically-labelled
            link to the page they're already on, right after the header's.
            The alt text still carries the brand name while the header
            logo is hidden over the hero. */}
        <div className="hero-masthead absolute left-1/2 top-1/2 z-10">
          <Image
            // logo-lg is a separate asset from the small nav-bar logo
            // (brand.logo.src, 560x175) — its own intrinsic size is used
            // here rather than brand.logo.width/height, which describe
            // the small file and would slightly skew this one's aspect.
            src={logo.srcLarge}
            alt={logo.alt}
            width={1200}
            height={376}
            priority
            style={{ height: "auto" }}
            className="w-[clamp(260px,66vw,1180px)] drop-shadow-[0_6px_40px_rgba(4,33,29,0.45)]"
          />
        </div>

        <div className="grid h-[min(100svh,1040px)] grid-cols-1 gap-0.5 lg:grid-cols-2">
          {/* No header-height offset here: the header is position:fixed and
              overlaid (transparent) on the homepage, so it never occupies
              in-flow space above this hero. */}
          <div className="relative h-[min(100svh,720px)] bg-warm-linen lg:h-full">
            <Image
              src={hero.image}
              alt={hero.imageAlt}
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="relative hidden bg-paper-tint lg:block">
            <Image
              src={hero.imageRight}
              alt={hero.imageRightAlt}
              fill
              sizes="50vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[46ch] px-4 pt-8 text-center sm:px-6">
        {hero.accentWord && (
          <p className="font-display mb-1.5 text-lg italic text-teal">{hero.accentWord}</p>
        )}
        <h1 className="text-[13px] uppercase tracking-[0.18em] text-ink">{hero.headline}</h1>
        <p className="mt-3.5 text-[15px] leading-relaxed text-ink-soft">{hero.subline}</p>
        <Link
          href={hero.ctaHref}
          className="mt-6 inline-block bg-teal px-9 py-4 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-teal-deep"
        >
          {hero.ctaLabel}
        </Link>
      </div>
    </section>
  );
}
