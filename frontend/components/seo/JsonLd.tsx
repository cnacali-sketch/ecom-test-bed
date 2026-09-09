// Renders a schema.org JSON-LD block.
//
// The payload is built by lib/seo.ts from our own catalogue and config — never
// from user input — and JSON.stringify escapes it, so there is no injection
// surface here. Server component: this is markup for crawlers, and shipping it
// to the client would be pure dead weight.

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
