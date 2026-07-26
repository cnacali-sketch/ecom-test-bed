import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { fetchHomepageContent } from "@/lib/api";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Category shortcut tiles under the hero. Whole-list override from the
 * admin Homepage editor (GET /api/sections) when set, else site.config.ts.
 */
export async function QuickCtaRow() {
  const override = await fetchHomepageContent();
  const quickCtas = override?.quick_ctas?.length ? override.quick_ctas : siteConfig.home.quickCtas;

  return (
    <section className="border-y border-ink/10 bg-paper-tint">
      <div className="mx-auto flex max-w-6xl snap-x snap-mandatory gap-3 overflow-x-auto px-4 py-8 [scrollbar-width:none] sm:px-6 md:grid md:grid-cols-4 md:gap-px md:overflow-visible [&::-webkit-scrollbar]:hidden">
        {quickCtas.map((cta, index) => (
          <Reveal key={cta.label} delay={index * 70} className="w-36 shrink-0 snap-start md:w-auto">
            <Link href={cta.href} className="group block p-2 text-center">
              <span className="relative mx-auto block aspect-square w-full max-w-[180px] overflow-hidden rounded-full ring-1 ring-ink/10 transition-shadow duration-300 group-hover:ring-2 group-hover:ring-teal">
                <Image
                  src={cta.image}
                  alt={cta.label}
                  fill
                  sizes="180px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </span>
              <span className="mt-3 inline-block text-xs uppercase tracking-[0.16em] text-ink transition-colors group-hover:text-teal">
                {cta.label}
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
