import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";

const FOOTER_COLUMNS = [
  {
    heading: "Company",
    links: [
      { label: "Store Locator", href: "/pages/store-locator" },
      { label: "About Us", href: "/pages/about" },
      { label: "Blog", href: "/pages/blog" },
    ],
  },
  {
    heading: "Customer Service",
    links: [
      { label: "Track Order", href: "/pages/track-order" },
      { label: "Returns & Exchanges", href: "/pages/returns" },
      { label: "FAQ", href: "/pages/faq" },
      { label: "Contact Us", href: "/pages/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Shipping Policy", href: "/pages/shipping" },
      { label: "Privacy Policy", href: "/pages/privacy" },
      { label: "Terms & Conditions", href: "/pages/terms" },
    ],
  },
];

const SOCIAL_LINKS = ["Instagram", "Facebook", "YouTube"];

/** Company info / customer service / legal columns + newsletter + social links. */
export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="mb-3 text-sm font-semibold text-neutral-900">{column.heading}</p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-neutral-600 hover:text-neutral-900">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="mb-3 text-sm font-semibold text-neutral-900">Stay in the loop</p>
            <NewsletterForm />

            <div className="mt-4 flex gap-3">
              {SOCIAL_LINKS.map((social) => (
                <span key={social} className="text-xs text-neutral-500">
                  {social}
                </span>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-10 border-t border-neutral-200 pt-6 text-xs text-neutral-400">
          © {new Date().getFullYear()} Savvy. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
