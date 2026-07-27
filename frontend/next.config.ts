import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output copies only the production node_modules subset needed
  // to run `node server.js` into .next/standalone — a much smaller Docker
  // image than shipping the full node_modules tree.
  output: "standalone",
  images: {
    // Serve remote images directly to the browser. The Next image
    // optimizer proxies remote URLs through the Node server, which
    // fails in some WSL/proxy environments (and cannot process SVG
    // placeholders) — direct loading is robust for a test bed.
    unoptimized: true,
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
