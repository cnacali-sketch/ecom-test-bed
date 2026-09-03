import type { Metadata } from "next";

import { PolicyPage } from "@/components/policies/PolicyPage";
import { siteConfig } from "@/content/site.config";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  const { updated, sections } = siteConfig.policies.privacy;
  return <PolicyPage title="Privacy Policy" updated={updated} sections={sections} />;
}
