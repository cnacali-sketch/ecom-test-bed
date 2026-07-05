import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ],
  },
};

export default nextConfig;
