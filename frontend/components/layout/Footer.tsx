import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { NewsletterForm } from "./NewsletterForm";

/** Footer: newsletter, link columns, logo, fineprint — all from site config. */
export function Footer() {
  const { brand, footer } = siteConfig;

  return (
    <footer className="border-t border-ink/10 bg-paper">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <h3 className="font-display text-2xl italic text-ink">{footer.newsletter.heading}</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">{footer.newsletter.copy}</p>
          <div className="mt-5">
            <NewsletterForm
              placeholder={footer.newsletter.placeholder}
              buttonLabel={footer.newsletter.buttonLabel}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {footer.columns.map((column) => (
            <div key={column.heading}>
              <p className="eyebrow mb-3">{column.heading}</p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-ink-soft transition-colors hover:text-teal">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 sm:flex-row sm:justify-between sm:px-6">
          <Image src={brand.logo.src} alt={brand.logo.alt} width={200} height={62} className="h-8 w-auto opacity-90" />
          <p className="text-xs text-ink-soft">
            © {new Date().getFullYear()} {brand.name}. {footer.fineprint}
          </p>
        </div>
      </div>
    </footer>
  );
}
