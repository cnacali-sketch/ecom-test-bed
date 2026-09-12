import type { Metadata } from "next";

import { PolicyPage } from "@/components/policies/PolicyPage";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Refund & Cancellation Policy" };

export default async function RefundPolicyPage() {
  const { updated, sections } = (await getSiteContent()).policies.refund;
  return <PolicyPage title="Refund & Cancellation Policy" updated={updated} sections={sections} />;
}
