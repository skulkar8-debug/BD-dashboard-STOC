import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Suppress multi-lockfile workspace root warning when deploying from a subdirectory
  outputFileTracingRoot: path.join(__dirname, "../"),

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.stocadvisory.com",
      },
    ],
  },
};

export default nextConfig;
