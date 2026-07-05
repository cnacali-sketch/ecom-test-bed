// Placeholder navigation/mega-menu data — generic categories, no proprietary copy.

export interface NavItem {
  label: string;
  href: string;
  megaMenu?: {
    columns: { heading: string; links: { label: string; href: string }[] }[];
    promoImage: string;
    promoLabel: string;
    promoHref: string;
  };
}

const promo = (seed: string) =>
  `https://placehold.co/320x320/f3ede4/1a1a1a?text=${encodeURIComponent(seed)}`;

export const NAV_ITEMS: NavItem[] = [
  {
    label: "New In",
    href: "/collections/new-in",
    megaMenu: {
      columns: [
        {
          heading: "Shop All",
          links: [
            { label: "Bags", href: "/collections/bags" },
            { label: "Jewellery", href: "/collections/jewellery" },
            { label: "Accessories", href: "/collections/accessories" },
          ],
        },
        {
          heading: "Trending",
          links: [
            { label: "Best Sellers", href: "/collections/bags" },
            { label: "Under 999", href: "/collections/jewellery" },
          ],
        },
      ],
      promoImage: promo("New In"),
      promoLabel: "This Week's Drop",
      promoHref: "/collections/bags",
    },
  },
  {
    label: "Bags",
    href: "/collections/bags",
    megaMenu: {
      columns: [
        {
          heading: "Shop by Type",
          links: [
            { label: "Totes", href: "/collections/bags" },
            { label: "Sling Bags", href: "/collections/bags" },
            { label: "Clutches", href: "/collections/bags" },
            { label: "Backpacks", href: "/collections/bags" },
          ],
        },
        {
          heading: "Shop by Occasion",
          links: [
            { label: "Everyday Carry", href: "/collections/bags" },
            { label: "Evening", href: "/collections/bags" },
            { label: "Travel", href: "/collections/bags" },
          ],
        },
      ],
      promoImage: promo("Bags"),
      promoLabel: "Everyday Carry Edit",
      promoHref: "/collections/bags",
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
            { label: "Bracelets", href: "/collections/jewellery" },
          ],
        },
        {
          heading: "Shop by Finish",
          links: [
            { label: "Gold Plated", href: "/collections/jewellery" },
            { label: "Waterproof", href: "/collections/jewellery" },
            { label: "Sterling Silver", href: "/collections/jewellery" },
          ],
        },
      ],
      promoImage: promo("Jewellery"),
      promoLabel: "Stack & Layer",
      promoHref: "/collections/jewellery",
    },
  },
  { label: "Accessories", href: "/collections/jewellery" },
  { label: "Sale", href: "/collections/bags" },
];
