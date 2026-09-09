import { ImageResponse } from "next/og";
import { siteConfig } from "@/content/site.config";

// Default share card for any page that does not supply its own image.
// Product and collection pages override it with real photography.
// Generated rather than a static asset: public/ holds only the logo files,
// and a generated card stays in sync if the brand copy changes.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${siteConfig.brand.name} — ${siteConfig.brand.tagline}`;

// Palette mirrors globals.css (--paper / --ink / --teal / --gold).
const PAPER = "#fbf7f2";
const INK = "#0d1615";
const TEAL = "#1f6f6b";
const GOLD = "#b08d3f";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: PAPER,
          padding: "88px 96px",
          borderBottom: `24px solid ${TEAL}`,
        }}
      >
        <div
          style={{
            fontSize: 26,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: GOLD,
            display: "flex",
          }}
        >
          {siteConfig.brand.tagline}
        </div>
        <div style={{ fontSize: 104, color: INK, marginTop: 18, display: "flex" }}>
          {siteConfig.brand.name}
        </div>
        <div style={{ fontSize: 32, color: INK, opacity: 0.72, marginTop: 26, maxWidth: 900, display: "flex" }}>
          {siteConfig.brand.description}
        </div>
      </div>
    ),
    size,
  );
}
