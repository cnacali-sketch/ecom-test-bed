const BADGES = [
  { icon: "✓", label: "100% Guaranteed", description: "Quality checked" },
  { icon: "🔒", label: "Secure Checkout", description: "Encrypted payments" },
  { icon: "↺", label: "Easy Returns", description: "15-day return window" },
  { icon: "🚚", label: "Fast Shipping", description: "Dispatched in 2 days" },
];

/** Shared spine component: small badge row shown on PDP and near filters. */
export function TrustBadges() {
  return (
    <ul className="grid grid-cols-2 gap-4 border-y border-neutral-200 py-4 sm:grid-cols-4">
      {BADGES.map((badge) => (
        <li key={badge.label} className="flex items-start gap-2 text-sm">
          <span aria-hidden="true" className="text-lg leading-none">
            {badge.icon}
          </span>
          <div>
            <p className="font-medium text-neutral-900">{badge.label}</p>
            <p className="text-xs text-neutral-500">{badge.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
