import type { Metadata } from "next";

import { PolicyPage } from "@/components/policies/PolicyPage";
import { siteConfig } from "@/content/site.config";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  const { updated, sections } = siteConfig.policies.terms;
  return <PolicyPage title="Terms & Conditions" updated={updated} sections={sections} />;
}
