import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { fetchHomepageContent } from "@/lib/api";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Full-bleed teal campaign band — the page's strong mid-scroll moment.
 * Content from siteConfig.home.campaign, per-field overridden by the admin
 * Homepage editor (GET /api/sections) when set.
 */
export async function CampaignBand() {
  const defaults = siteConfig.home.campaign;
  const override = await fetchHomepageContent();
  const campaign = {
    eyebrow: override?.campaign_eyebrow || defaults.eyebrow,
    titleItalic: override?.campaign_title_italic || defaults.titleItalic,
    title: override?.campaign_title || defaults.title,
    copy: override?.campaign_copy || defaults.copy,
    ctaLabel: override?.campaign_cta_label || defaults.ctaLabel,
    ctaHref: override?.campaign_cta_href || defaults.ctaHref,
    image: override?.campaign_image || defaults.image,
    imageAlt: override?.campaign_image_alt || defaults.imageAlt,
  };

  return (
    <section className="bg-teal text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <Reveal>
          <p className="text-[11px] uppercase tracking-[0.22em] text-blush">{campaign.eyebrow}</p>
          <h2 className="mt-4 leading-[1.02]">
            <span className="font-display block text-5xl italic text-gold sm:text-6xl lg:text-7xl">
              {campaign.titleItalic}
            </span>
            <span className="mt-1 block text-2xl uppercase tracking-[0.1em] sm:text-3xl">
              {campaign.title}
            </span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/80">{campaign.copy}</p>
          <Link
            href={campaign.ctaHref}
            className="mt-8 inline-block border border-white/70 px-8 py-3.5 text-xs uppercase tracking-[0.18em] text-white transition-colors hover:bg-white hover:text-teal"
          >
            {campaign.ctaLabel}
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            <Image
              src={campaign.image}
              alt={campaign.imageAlt}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-3 border border-white/30" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
