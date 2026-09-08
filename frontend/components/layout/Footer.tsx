import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/content/site.config";
import { NewsletterForm } from "./NewsletterForm";

/**
 * Dark "specimen" footer panel — a glass card floating on the teal-black
 * surface (the removed design prototype's footer.site treatment), replacing the
 * previous plain light footer. Structure: return-to-top pill, a lead column
 * (brand mark, headline, CTAs, newsletter — newsletter logic/state is
 * unchanged, just restyled for the dark surface), three link columns with
 * socials under Help, then a legal rule. All copy/links from site config.
 */
export function Footer() {
  const { footer } = siteConfig;

  return (
    <footer className="relative isolate overflow-hidden bg-specimen px-4 pb-10 text-white sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-10%] -inset-y-[20%] -z-10 blur-3xl"
        style={{
          background:
            "radial-gradient(38% 44% at 18% 22%, rgba(46,230,207,0.30), transparent 70%), radial-gradient(34% 40% at 82% 68%, rgba(31,111,107,0.55), transparent 72%)",
        }}
      />

      <div className="flex justify-center py-9">
        <a
          href="#top"
          className="inline-flex items-center gap-2.5 rounded-full border border-white/30 bg-white/[0.06] px-6 py-3 text-[13px] text-white backdrop-blur-md transition-colors hover:border-acid hover:bg-acid hover:text-specimen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {footer.returnToTop}
        </a>
      </div>

      <div className="mx-auto max-w-6xl rounded-[28px] border border-white/[0.14] bg-white/[0.06] px-6 py-10 backdrop-blur-2xl sm:px-11">
        <div className="grid grid-cols-1 gap-9 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="col-span-full lg:col-span-1">
            <Link href="/" aria-label={footer.brandMark.alt} className="mb-5 block leading-none">
              <Image src={footer.brandMark.src} alt={footer.brandMark.alt} width={220} height={69} className="h-[54px] w-auto" />
            </Link>
            <h2 className="max-w-[18ch] font-display text-[28px] italic leading-tight text-white sm:text-[34px]">
              {footer.headline}
            </h2>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {footer.actions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className={
                    action.style === "filled"
                      ? "rounded-full border border-acid bg-acid px-6 py-2.5 text-[13px] text-specimen transition-colors hover:border-white hover:bg-white"
                      : "rounded-full border border-white/42 px-6 py-2.5 text-[13px] text-white transition-colors hover:border-white hover:bg-white hover:text-specimen"
                  }
                >
                  {action.label}
                </Link>
              ))}
            </div>
            <div className="mt-8 max-w-sm">
              <p className="text-sm font-medium text-white">{footer.newsletter.heading}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/60">{footer.newsletter.copy}</p>
              <div className="mt-3 [&_input]:border-white/25 [&_input]:bg-transparent [&_input]:text-white [&_input]:placeholder:text-white/50 [&_button]:bg-acid [&_button]:text-specimen [&_button:hover]:bg-white">
                <NewsletterForm placeholder={footer.newsletter.placeholder} buttonLabel={footer.newsletter.buttonLabel} />
              </div>
            </div>
          </div>

          {footer.columns.map((column, index) => (
            <div key={column.heading}>
              <p className="mb-4 text-xs uppercase tracking-[0.16em] text-acid">{column.heading}</p>
              <ul className="flex flex-col gap-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/74 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              {index === footer.columns.length - 1 && (
                <div className="mt-6 flex gap-3.5">
                  {footer.socials.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      aria-label={social.label}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="grid h-9 w-9 place-items-center rounded-full border border-white/22 text-white transition-colors hover:border-acid hover:bg-acid hover:text-specimen"
                    >
                      <SocialIcon name={social.label} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-4 border-t border-white/[0.14] pt-5 text-[13px] text-white/60">
          <span>
            © {new Date().getFullYear()} {siteConfig.brand.name}
            {footer.fineprint ? `. ${footer.fineprint}` : ""}
          </span>
          <span className="flex flex-wrap gap-2">
            {footer.legal.map((item, index) => (
              <span key={item.label} className="flex items-center gap-2">
                <Link href={item.href} className="transition-colors hover:text-acid">
                  {item.label}
                </Link>
                {index < footer.legal.length - 1 && <span aria-hidden>·</span>}
              </span>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ name }: { name: string }) {
  if (name === "Instagram") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" />
      </svg>
    );
  }
  if (name === "Facebook") {
    return (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H7v3h2v9h3v-9h2.5l.5-3H12V6.5a1 1 0 0 1 1-1h2z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 21l1.7-4.4A8 8 0 1 1 8 20.2z" strokeLinejoin="round" />
    </svg>
  );
}
