import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output copies only the production node_modules subset needed
  // to run `node server.js` into .next/standalone — a much smaller Docker
  // image than shipping the full node_modules tree.
  output: "standalone",
  images: {
    // A custom loader, not the built-in optimizer.
    //
    // This was `unoptimized: true` because the Next optimizer proxies remote
    // images through the Node server, which fails in some WSL/proxy
    // environments and cannot process SVG placeholders. That reasoning still
    // holds and the optimizer is still not used: a loader is a pure function
    // from (src, width) to a URL, run at render time, proxying nothing.
    //
    // What `unoptimized` also did, though, was switch off srcset generation
    // entirely — so every `sizes` prop in the storefront was decorative and a
    // phone downloaded the same file as a desktop. See lib/image-loader.ts.
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
    // The widths the loader is ever asked for. Kept in step with
    // MEDIA_WIDTHS so a /media request cannot land between two derivatives.
    deviceSizes: [400, 800, 1200],
    imageSizes: [400],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
      {
        // Admin-uploaded media (ImageDrop -> POST /api/media), served by the
        // backend's StaticFiles mount at /media.
        protocol: "https",
        hostname: "api.savvyinteal.com",
      },
    ],
  },
};

export default nextConfig;
