import type { Metadata } from "next";

import { PolicyPage } from "@/components/policies/PolicyPage";
import { siteConfig } from "@/content/site.config";

export const metadata: Metadata = { title: "Returns & Exchanges" };

export default function ReturnsPolicyPage() {
  const { updated, sections } = siteConfig.policies.returns;
  return <PolicyPage title="Returns & Exchanges" updated={updated} sections={sections} />;
}
