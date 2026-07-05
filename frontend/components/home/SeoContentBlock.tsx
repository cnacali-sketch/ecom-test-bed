import { AccordionSection } from "@/components/product/AccordionSection";

const CATEGORY_BLURBS = [
  {
    heading: "Bags Built for Every Day",
    body: "From structured totes that carry a laptop and a week's worth of errands to slouchy slings for hands-free days, our bag edit is designed around how you actually move — not just how a bag photographs on a shelf.",
  },
  {
    heading: "Jewellery You Can Live In",
    body: "Waterproof platings, hypoallergenic bases, and stack-friendly silhouettes mean our jewellery survives gym bags, monsoons, and back-to-back plans — not just special occasions.",
  },
  {
    heading: "Hair Accessories, Considered",
    body: "Claw clips sized for thick hair, skinny bands for slick styles, and everything in between — our hair edit treats accessories as a daily styling tool, not an afterthought.",
  },
];

const FAQS = [
  {
    question: "How long does shipping take?",
    answer: "Orders ship within 2 business days and typically arrive within 3-7 business days depending on your location.",
  },
  {
    question: "What is your return policy?",
    answer: "We offer easy 15-day returns on unworn items with tags attached. Start a return from your account or contact support.",
  },
  {
    question: "Do you offer gift wrapping?",
    answer: "Yes — select gift wrapping at checkout for a small additional fee, and add a personalized note.",
  },
  {
    question: "How do I care for gold-plated jewellery?",
    answer: "Avoid direct contact with perfume, lotion, and water where possible. Store pieces in a dry pouch and wipe with a soft cloth after wear.",
  },
];

/** Long-form brand/category copy blocks + FAQ accordion (Accessorize pattern), for SEO. */
export function SeoContentBlock() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-12 max-w-3xl">
        <h2 className="mb-4 text-2xl font-semibold text-neutral-900">
          Everyday Accessories, Thoughtfully Made
        </h2>
        <p className="text-sm leading-relaxed text-neutral-600">
          Savvy is built on a simple idea: accessories should be affordable, stackable, and sturdy
          enough for real life. Every bag, earring, and hair clip in our range is chosen for how it
          performs day-to-day, not just how it looks in a single photo. We keep prices accessible
          without cutting corners on hardware, plating, or stitching — so you can complete every
          outfit with a little more confidence and a little less compromise.
        </p>
      </div>

      <div className="mb-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
        {CATEGORY_BLURBS.map((blurb) => (
          <div key={blurb.heading}>
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">{blurb.heading}</h3>
            <p className="text-sm leading-relaxed text-neutral-600">{blurb.body}</p>
          </div>
        ))}
      </div>

      <div className="max-w-2xl">
        <h3 className="mb-2 text-lg font-semibold text-neutral-900">Frequently Asked Questions</h3>
        <div>
          {FAQS.map((faq, index) => (
            <AccordionSection key={faq.question} title={faq.question} defaultOpen={index === 0}>
              {faq.answer}
            </AccordionSection>
          ))}
        </div>
      </div>
    </section>
  );
}
