import Link from "next/link";

interface PolicySection {
  heading: string;
  body: string;
}

interface PolicyPageProps {
  title: string;
  updated: string;
  sections: readonly PolicySection[];
}

// Shared shell for the terms/refund/returns pages — same title + updated-date
// + section-list shape for all three, driven by content/site.config.ts.
export function PolicyPage({ title, updated, sections }: PolicyPageProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="eyebrow flex items-center gap-3">
        <span aria-hidden className="h-px w-8 bg-gold" />
        Savvy In Teal
      </p>
      <h1 className="font-display mt-4 text-4xl italic text-ink">{title}</h1>
      <p className="mt-2 text-xs uppercase tracking-wide text-ink-soft">Last updated {updated}</p>

      <div className="mt-6 border-l-2 border-gold bg-gold/5 px-4 py-3 text-sm text-ink-soft">
        Draft policy — pending review before this store takes real orders.
      </div>

      <div className="mt-8 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-lg italic text-ink">{section.heading}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{section.body}</p>
          </section>
        ))}
      </div>

      <Link
        href="/"
        className="mt-12 inline-block border border-teal px-8 py-3 text-xs uppercase tracking-[0.18em] text-teal transition-colors hover:bg-teal hover:text-white"
      >
        Back to shop
      </Link>
    </div>
  );
}
