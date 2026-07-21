/**
 * ============================================================
 * SITE CONFIG — the one file that defines this storefront.
 * ============================================================
 *
 * EDIT ME: Rebranding to a new shop (different products, different
 * genre) should mostly happen HERE and in `content/catalog.ts`.
 * Components read from this file; they contain no brand copy.
 *
 * Vibe-coding guide for owners + LLMs: see docs/EDITING.md
 * and .claude/skills/storefront-editing/SKILL.md.
 */

export interface NavLink {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  megaMenu?: {
    columns: { heading: string; links: NavLink[] }[];
    promoImage: string;
    promoLabel: string;
    promoHref: string;
  };
}

/** Pexels CDN helper — free license, no attribution required. */
export const px = (id: number, w = 800, h = 1000) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`;

export const siteConfig = {
  // ---------- Brand ----------
  brand: {
    name: "Savvy In Teal",
    /** Header logo (gold script over watercolor florals). Swap these files in /public/brand to rebrand. */
    logo: {
      src: "/brand/logo.webp",
      srcLarge: "/brand/logo-lg.webp",
      width: 560,
      height: 175,
      alt: "Savvy In Teal",
    },
    /** Small word rendered in italic serif next to wordmark fallbacks. */
    logoAccent: "in teal",
    tagline: "Hair accessories & everyday jewellery",
    description:
      "Claw clips, barrettes, silk scrunchies and everyday jewellery built for daily wear. Considered, sturdy, easy to love — signed in teal.",
    /** Used in <html lang> and price formatting */
    locale: "en-IN",
    currency: "INR" as const,
    /** Shown under prices (India MRP transparency, Zara pattern). Empty string hides it. */
    taxLine: "MRP incl. of all taxes",
  },

  // ---------- Announcement ribbon (scrolling marquee in the header) ----------
  announcement: {
    enabled: true,
    messages: [
      "Free shipping on orders over ₹1,499",
      "Easy 15-day returns",
      "New drop: the Teal Edit",
      "Silk scrunchies restocked",
    ],
  },

  // ---------- Navigation ----------
  nav: [
    {
      label: "New In",
      href: "/collections/hair-accessories",
      megaMenu: {
        columns: [
          {
            heading: "Just Landed",
            links: [
              { label: "Hair Accessories", href: "/collections/hair-accessories" },
              { label: "Jewellery", href: "/collections/jewellery" },
            ],
          },
          {
            heading: "Trending",
            links: [
              { label: "The Tortoise Edit", href: "/collections/hair-accessories" },
              { label: "Silk Scrunchies", href: "/collections/hair-accessories" },
              { label: "Everyday Gold", href: "/collections/jewellery" },
            ],
          },
        ],
        promoImage: px(31854724, 480, 480),
        promoLabel: "This Week's Drop",
        promoHref: "/collections/hair-accessories",
      },
    },
    {
      label: "Hair Accessories",
      href: "/collections/hair-accessories",
      megaMenu: {
        columns: [
          {
            heading: "Shop by Type",
            links: [
              { label: "Claw Clips", href: "/collections/hair-accessories" },
              { label: "Barrettes", href: "/collections/hair-accessories" },
              { label: "Scrunchies & Ties", href: "/collections/hair-accessories" },
              { label: "Pins & Combs", href: "/collections/hair-accessories" },
            ],
          },
          {
            heading: "Shop by Hair",
            links: [
              { label: "For Thick Hair", href: "/collections/hair-accessories" },
              { label: "For Fine Hair", href: "/collections/hair-accessories" },
              { label: "Grab & Go", href: "/collections/hair-accessories" },
            ],
          },
        ],
        promoImage: px(33343186, 480, 480),
        promoLabel: "The Neutral Shelf",
        promoHref: "/collections/hair-accessories",
      },
    },
    {
      label: "Jewellery",
      href: "/collections/jewellery",
      megaMenu: {
        columns: [
          {
            heading: "Shop by Type",
            links: [
              { label: "Earrings", href: "/collections/jewellery" },
              { label: "Necklaces", href: "/collections/jewellery" },
            ],
          },
          {
            heading: "Shop by Finish",
            links: [
              { label: "Gold Tone", href: "/collections/jewellery" },
              { label: "Pearl & Stone", href: "/collections/jewellery" },
            ],
          },
        ],
        promoImage: px(12144990, 480, 480),
        promoLabel: "Everyday Gold",
        promoHref: "/collections/jewellery",
      },
    },
    { label: "Sale", href: "/collections/hair-accessories" },
  ] satisfies NavItem[],

  // ---------- Homepage ----------
  home: {
    hero: {
      /** The oversized italic word — the page's signature moment. */
      accentWord: "Held",
      headline: "in place, beautifully.",
      subline:
        "Claw clips, barrettes and silk that treat a Tuesday like an occasion. The new drop is here.",
      ctaLabel: "Shop the drop",
      ctaHref: "/collections/hair-accessories",
      image: px(22469099, 1400, 1750),
      imageAlt: "Sunlight on long hair held with a clip",
      /** Small stacked image peeking behind the hero portrait. */
      secondaryImage: px(31854724, 700, 875),
      secondaryImageAlt: "Hair clips arranged in a shell dish",
    },
    quickCtas: [
      { label: "Claw Clips", href: "/collections/hair-accessories", image: px(33343186, 640, 640) },
      { label: "Scrunchies", href: "/collections/hair-accessories", image: px(37195179, 640, 640) },
      { label: "Barrettes", href: "/collections/hair-accessories", image: px(20166056, 640, 640) },
      { label: "Jewellery", href: "/collections/jewellery", image: px(12144990, 640, 640) },
    ],
    newInHeading: "New In",
    newInSub: "Fresh from the studio — restocked weekly.",
    /** Full-bleed teal campaign band mid-page. */
    campaign: {
      eyebrow: "The Teal Edit",
      titleItalic: "Signed",
      title: "in our colour.",
      copy: "A capsule of clips, silk and gold picked around the shade we're named after. Limited run, restocked never.",
      ctaLabel: "Explore the edit",
      ctaHref: "/collections/hair-accessories",
      image: px(33617637, 1000, 1250),
      imageAlt: "Back view of a woman with hair clips against greenery",
    },
    editorialTiles: [
      {
        eyebrow: "The Edit",
        title: "Worn, not stored",
        copy: "Pieces made for actual days — school runs, standing fans, monsoon commutes.",
        href: "/collections/hair-accessories",
        image: px(29346469, 900, 1125),
        imageAlt: "Monochrome portrait of a young woman wearing hair clips",
      },
      {
        eyebrow: "Materials",
        title: "Acetate, silk, steel",
        copy: "Cellulose acetate that won't snap, mulberry silk that won't crease your hair.",
        href: "/collections/hair-accessories",
        image: px(6044137, 900, 1125),
        imageAlt: "Hair ties with flowers on a decorative box",
      },
      {
        eyebrow: "Jewellery",
        title: "Everyday gold",
        copy: "Hoops and pendants with waterproof plating — wear them in, not just out.",
        href: "/collections/jewellery",
        image: px(15787782, 900, 1125),
        imageAlt: "Golden earrings resting on an open book",
      },
    ],
    seo: {
      brandStory:
        "Savvy makes hair accessories and jewellery for everyday wear — pieces that hold up to real days and still look considered. We design around three materials we trust: cellulose acetate for grip and shine, mulberry silk for gentleness, and steel or brass cores for pieces that outlast trends. Everything ships from our Bengaluru studio with easy 15-day returns.",
      categories: [
        {
          title: "Hair Accessories",
          copy: "Claw clips sized for thick and fine hair, French barrettes with steel spring closures, and silk scrunchies that skip the crease. If it goes in your hair, it's built to stay put.",
          href: "/collections/hair-accessories",
        },
        {
          title: "Jewellery",
          copy: "Gold-tone hoops, pearl-detail pins and pendants with waterproof plating — everyday pieces designed for stacking, layering and forgetting you have them on.",
          href: "/collections/jewellery",
        },
      ],
      faqs: [
        {
          q: "Do the claw clips work for thick hair?",
          a: "Yes — our large claw clips use a wider spring and longer teeth designed for thick or curly hair. Product pages note the recommended hair type for every clip.",
        },
        {
          q: "Is the jewellery plating waterproof?",
          a: "Our everyday jewellery line uses PVD gold-tone plating that resists water and sweat. We still recommend keeping perfume and chlorine away from any plated piece.",
        },
        {
          q: "What is your return policy?",
          a: "15-day easy returns on unused items in original packaging. Start a return from your order confirmation email or write to us — we make it painless.",
        },
      ],
    },
  },

  // ---------- Footer ----------
  footer: {
    newsletter: {
      heading: "First dibs on drops",
      copy: "One email a week. New pieces, restocks, and the occasional studio note.",
      placeholder: "Your email",
      buttonLabel: "Sign up",
    },
    columns: [
      {
        heading: "Shop",
        links: [
          { label: "Hair Accessories", href: "/collections/hair-accessories" },
          { label: "Jewellery", href: "/collections/jewellery" },
        ],
      },
      {
        heading: "Help",
        links: [
          { label: "Track Order", href: "/coming-soon" },
          { label: "Returns & Exchanges", href: "/coming-soon" },
          { label: "Contact", href: "/coming-soon" },
          { label: "FAQ", href: "/coming-soon" },
        ],
      },
      {
        heading: "Company",
        links: [
          { label: "Privacy", href: "/coming-soon" },
          { label: "Terms", href: "/coming-soon" },
        ],
      },
    ],
    fineprint: "Photography via Pexels (free license). Demo storefront — not a live shop.",
  },
} as const;

export type SiteConfig = typeof siteConfig;
