import type { Metadata } from "next";

import { PolicyPage } from "@/components/policies/PolicyPage";
import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function PrivacyPolicyPage() {
  const { updated, sections } = (await getSiteContent()).policies.privacy;
  return <PolicyPage title="Privacy Policy" updated={updated} sections={sections} />;
}
