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
    {
      label: "Charms",
      href: "/collections/charms",
      megaMenu: {
        columns: [
          {
            heading: "Shop by Type",
            links: [
              { label: "Bag Charms", href: "/collections/charms" },
              { label: "Zip Charms", href: "/collections/charms" },
            ],
          },
          {
            heading: "Shop by Style",
            links: [
              { label: "Tassels", href: "/collections/charms" },
              { label: "Enamel & Pearl", href: "/collections/charms" },
            ],
          },
        ],
        promoImage: px(7723760, 480, 480),
        promoLabel: "New: Bag & Zip Charms",
        promoHref: "/collections/charms",
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
          { label: "Charms", href: "/collections/charms" },
        ],
      },
      {
        heading: "Help",
        links: [
          { label: "Track Order", href: "/track-order" },
          { label: "Returns & Exchanges", href: "/policies/returns" },
          { label: "Refund Policy", href: "/policies/refund" },
          { label: "Contact", href: "/coming-soon" },
          { label: "FAQ", href: "/coming-soon" },
        ],
      },
      {
        heading: "Company",
        links: [
          { label: "Privacy", href: "/coming-soon" },
          { label: "Terms", href: "/policies/terms" },
        ],
      },
    ],
    fineprint: "Photography via Pexels (free license). Demo storefront — not a live shop.",
  },

  // ---------- Legal / policy pages ----------
  // PLACEHOLDER COPY. Every section below is a starting draft, not reviewed
  // legal text — read through and edit before this store takes real orders.
  // `termsVersion` is the string stamped onto every order's consent record
  // (see checkout's T&C checkbox); bump it whenever the terms wording changes
  // so old orders keep an accurate record of which version they agreed to.
  policies: {
    termsVersion: "2026-07-22",
    terms: {
      updated: "22 July 2026",
      sections: [
        {
          heading: "Using this site",
          body: "By placing an order with Savvy In Teal you agree to these terms. [Placeholder — add your governing law, dispute process, and any age/eligibility requirements.]",
        },
        {
          heading: "Orders & pricing",
          body: "Prices are shown in INR and include applicable taxes unless stated otherwise. We reserve the right to cancel an order if a listed price or stock level was wrong. [Placeholder — confirm cancellation wording with your business.]",
        },
        {
          heading: "Payment",
          body: "Cash on Delivery is available today; online payment will be added at launch. [Placeholder — update this section once the payment gateway goes live.]",
        },
        {
          heading: "Contact",
          body: "Questions about these terms? Write to us — see the Contact link in the footer. [Placeholder — add a real support email or phone number.]",
        },
      ],
    },
    refund: {
      updated: "22 July 2026",
      sections: [
        {
          heading: "Refund window",
          body: "Approved returns are refunded within 15 days of us receiving the item back. [Placeholder — confirm this matches your actual processing time.]",
        },
        {
          heading: "Refund method",
          body: "[Placeholder — decide how Cash on Delivery orders get refunded: bank transfer, UPI, or store credit, and name it here. Prepaid orders would refund to the original payment method.]",
        },
        {
          heading: "Non-refundable items",
          body: "[Placeholder — list any final-sale or hygiene-sensitive items that can't be refunded, if any.]",
        },
      ],
    },
    returns: {
      updated: "22 July 2026",
      sections: [
        {
          heading: "Return window",
          body: "We accept return requests within 15 days of delivery, matching the returns policy already shown across the site.",
        },
        {
          heading: "Condition",
          body: "Items must be unused, unworn, and in original packaging. [Placeholder — confirm this matches what you actually want to enforce.]",
        },
        {
          heading: "How to start a return",
          body: "Sign in and open Your Orders to request a return on an eligible order.",
        },
        {
          heading: "Pickup",
          body: "[Placeholder — do you offer reverse pickup, or does the customer ship it back themselves? Specify courier and who pays.]",
        },
      ],
    },
  },
} as const;

export type SiteConfig = typeof siteConfig;
