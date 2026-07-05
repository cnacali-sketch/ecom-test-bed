import Image from "next/image";
import Link from "next/link";

interface MegaMenuColumn {
  heading: string;
  links: { label: string; href: string }[];
}

interface MegaMenuProps {
  columns: MegaMenuColumn[];
  promoImage: string;
  promoLabel: string;
  promoHref: string;
}

/**
 * Dropdown nav with subcategory columns + a promo image tile
 * (Accessorize-style mega-menu flyout).
 */
export function MegaMenu({ columns, promoImage, promoLabel, promoHref }: MegaMenuProps) {
  return (
    <div className="absolute left-0 top-full z-40 w-full border-t border-ink/10 bg-paper shadow-lg">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_1fr_1fr_320px] gap-8 px-6 py-8">
        {columns.map((column) => (
          <div key={column.heading}>
            <p className="mb-3 eyebrow">{column.heading}</p>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={`${column.heading}-${link.label}`}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-soft transition-colors hover:text-teal"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <Link href={promoHref} className="group relative block overflow-hidden">
          <div className="relative aspect-square w-full">
            <Image
              src={promoImage}
              alt={promoLabel}
              fill
              sizes="320px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-ink">{promoLabel}</p>
        </Link>
      </div>
    </div>
  );
}
