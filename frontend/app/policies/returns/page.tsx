import type { Metadata } from "next";

import { PolicyPage } from "@/components/policies/PolicyPage";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Returns & Exchanges" };

export default async function ReturnsPolicyPage() {
  const { updated, sections } = (await getSiteContent()).policies.returns;
  return <PolicyPage title="Returns & Exchanges" updated={updated} sections={sections} />;
}
