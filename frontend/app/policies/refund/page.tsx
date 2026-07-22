import type { Metadata } from "next";

import { PolicyPage } from "@/components/policies/PolicyPage";
import { siteConfig } from "@/content/site.config";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPolicyPage() {
  const { updated, sections } = siteConfig.policies.refund;
  return <PolicyPage title="Refund Policy" updated={updated} sections={sections} />;
}
