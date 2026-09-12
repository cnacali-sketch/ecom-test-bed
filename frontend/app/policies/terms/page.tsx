import type { Metadata } from "next";

import { PolicyPage } from "@/components/policies/PolicyPage";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default async function TermsPage() {
  const { updated, sections } = (await getSiteContent()).policies.terms;
  return <PolicyPage title="Terms & Conditions" updated={updated} sections={sections} />;
}
