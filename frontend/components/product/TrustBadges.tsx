import { siteConfig } from "@/content/site.config";

/** Shared spine component: small badge row shown on PDP and near filters.
 * Badge copy lives in content/site.config.ts (was hardcoded here). */
export function TrustBadges() {
  return (
    <ul className="grid grid-cols-2 gap-4 border-y border-rule-soft py-4 sm:grid-cols-4">
      {siteConfig.trustBadges.map((badge) => (
        <li key={badge.label} className="flex items-start gap-2 text-sm">
          <span aria-hidden="true" className="text-lg leading-none">
            {badge.icon}
          </span>
          <div>
            <p className="font-medium text-ink">{badge.label}</p>
            <p className="text-xs text-ink-soft">{badge.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
