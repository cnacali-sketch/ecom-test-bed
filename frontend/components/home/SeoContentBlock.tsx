import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { fetchHomepageContent } from "@/lib/api";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Brand story + per-category blurbs + FAQ accordion (native <details>).
 * Copy comes from siteConfig.home.seo by default, per-field or whole-list
 * overridden by the admin Homepage editor (GET /api/sections) when set.
 */
export async function SeoContentBlock() {
  const defaults = siteConfig.home.seo;
  const override = await fetchHomepageContent();
  const seo = {
    brandStory: override?.seo_brand_story || defaults.brandStory,
    categories: override?.seo_categories?.length ? override.seo_categories : defaults.categories,
    faqs: override?.seo_faqs?.length ? override.seo_faqs : defaults.faqs,
  };

  return (
    <section className="border-t border-ink/10 bg-paper-tint">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <p className="eyebrow">The studio</p>
          <p className="font-display mt-3 max-w-3xl text-xl italic leading-relaxed text-ink sm:text-2xl">
            {seo.brandStory}
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-2">
          {seo.categories.map((category, index) => (
            <Reveal key={category.title} delay={index * 80}>
              <h3 className="text-sm uppercase tracking-[0.16em] text-ink">{category.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{category.copy}</p>
              <Link
                href={category.href}
                className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-teal underline-offset-4 hover:underline"
              >
                Shop {category.title}
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14">
          <h3 className="text-sm uppercase tracking-[0.16em] text-ink">Questions, answered</h3>
          <div className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {seo.faqs.map((faq) => (
              <details key={faq.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm text-ink">
                  {faq.q}
                  <span aria-hidden className="text-ink-soft transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{faq.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
