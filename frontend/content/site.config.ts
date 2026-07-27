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
        image: px(7450827, 900, 1125),
        imageAlt: "Barrettes worn in curly hair, portrait",
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
          { label: "Refund & Cancellation Policy", href: "/policies/refund" },
          { label: "Contact", href: "/coming-soon" },
          { label: "FAQ", href: "/coming-soon" },
        ],
      },
      {
        heading: "Company",
        links: [
          { label: "Privacy", href: "/policies/privacy" },
          { label: "Terms", href: "/policies/terms" },
        ],
      },
    ],
    fineprint: "Photography via Pexels (free license). Demo storefront — not a live shop.",
  },

  // ---------- Legal / policy pages ----------
  // Reviewed copy — short, Razorpay-activation-compliant (refund/cancellation
  // timelines are explicit, not vague; contact + grievance officer named;
  // jurisdiction and data-hosting location stated). `termsVersion` is the
  // string stamped onto every order's consent record (see checkout's T&C
  // checkbox); bump it whenever the terms wording changes so old orders keep
  // an accurate record of which version they agreed to.
  policies: {
    termsVersion: "2026-07-27",
    terms: {
      updated: "27 July 2026",
      sections: [
        {
          heading: "About Savvy In Teal",
          body: "Savvy In Teal sells hair accessories and jewellery online, shipped from our studio in Bengaluru, India. These Terms govern your use of this website and any order you place with us.",
        },
        {
          heading: "Eligibility",
          body: "You must be at least 18 years old, or place your order with the involvement of a parent or guardian, to use this site.",
        },
        {
          heading: "Orders & pricing",
          body: "All prices are shown in INR and include applicable taxes unless stated otherwise. We reserve the right to cancel any order where a listed price or stock level was incorrect; if we cancel your order for this reason, you receive a full refund.",
        },
        {
          heading: "Payment",
          body: "We currently accept Cash on Delivery. Online payment via UPI, cards, and net banking, processed securely through Razorpay, is being added. We never see or store your card, UPI, or bank details — these are handled directly by Razorpay.",
        },
        {
          heading: "Cancellations & refunds",
          body: "See our Refund & Cancellation Policy for how to cancel an order and how refunds are processed.",
        },
        {
          heading: "Limitation of liability",
          body: "To the maximum extent permitted by law, Savvy In Teal is not liable for indirect or consequential losses arising from your use of this site or your order. Our total liability for any claim is limited to the amount you paid for the relevant order.",
        },
        {
          heading: "Governing law & disputes",
          body: "These Terms are governed by the laws of India. Courts located in Bangalore, Karnataka shall have exclusive jurisdiction over any dispute arising from these Terms.",
        },
        {
          heading: "Contact",
          body: "Questions about these Terms? Write to us at support@savvyinteal.com.",
        },
      ],
    },
    refund: {
      updated: "27 July 2026",
      sections: [
        {
          heading: "Cancellation",
          body: "Orders can be cancelled free of charge any time before they are shipped. Once shipped, cancellation is no longer possible — please use our return process instead (see our Returns & Exchanges policy).",
        },
        {
          heading: "Refund window",
          body: "Once we approve a return or cancellation, refunds are processed within 5–7 business days.",
        },
        {
          heading: "Refund method",
          body: "Cash on Delivery orders are refunded via UPI or bank transfer to the details you provide. Prepaid (online payment) orders are refunded to the original payment method through Razorpay.",
        },
        {
          heading: "Non-refundable items",
          body: "All items are eligible for return under our 15-day returns window (see Returns & Exchanges), provided they are unused, unworn, and in original packaging. There are no final-sale items at this time.",
        },
      ],
    },
    returns: {
      updated: "27 July 2026",
      sections: [
        {
          heading: "Return window",
          body: "We accept return requests within 15 days of delivery, matching the returns policy already shown across the site.",
        },
        {
          heading: "Condition",
          body: "Items must be unused, unworn, and returned in their original packaging with any tags or protective film intact.",
        },
        {
          heading: "How to start a return",
          body: "Sign in and open Your Orders to request a return on an eligible order.",
        },
        {
          heading: "Pickup",
          body: "We don't yet offer reverse pickup — please ship the item back to us using a courier of your choice. Once we receive and inspect it, your refund is processed per our Refund & Cancellation Policy.",
        },
      ],
    },
    privacy: {
      updated: "27 July 2026",
      sections: [
        {
          heading: "What we collect",
          body: "When you create an account, place an order, or browse this site, we may collect your name, email, phone number, shipping and billing address, and order/payment status. We never see or store your card, UPI, or bank details — these are handled directly by our payment partner, Razorpay. With your consent, we also collect anonymous browsing behaviour (pages viewed, device/browser type) to help us improve the site.",
        },
        {
          heading: "How we use it",
          body: "We use this information to process and deliver your orders, provide customer support, and prevent fraud — and, only with your consent, to understand how shoppers use our site. We do not sell your data to anyone.",
        },
        {
          heading: "Who we share it with",
          body: "We share order and payment details with Razorpay (to process payment) and our courier partners (to deliver your order). We do not share your data with advertisers or any other third party.",
        },
        {
          heading: "Cookies",
          body: "We use essential cookies to keep you signed in and your cart working. Optional analytics cookies are set only if you accept them, and you can decline them at any time.",
        },
        {
          heading: "Where your data is stored",
          body: "This website and its data are hosted on servers located in India.",
        },
        {
          heading: "Your rights",
          body: "You can view or update your profile from your account page at any time. To request a copy of your data, or ask us to delete your account, write to us at support@savvyinteal.com.",
        },
        {
          heading: "Grievance officer",
          body: "For any privacy or data-related complaint, contact our Grievance Officer: Savvy In Teal Support Team, support@savvyinteal.com.",
        },
        {
          heading: "Changes to this policy",
          body: "We may update this policy from time to time. The date above shows when it was last revised.",
        },
      ],
    },
  },
} as const;

export type SiteConfig = typeof siteConfig;
