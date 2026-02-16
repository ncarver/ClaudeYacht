import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: [
    "playwright",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
    "@prisma/client",
    "@anthropic-ai/sdk",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.boatsgroup.com",
      },
    ],
  },
};

export default nextConfig;
