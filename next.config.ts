import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Tell Turbopack that THIS directory is the project root, not the parent
  // monorepo directory. Prevents the path0/path0 double-path on Vercel when
  // a parent package-lock.json is detected as the workspace root.
  turbopack: {
    root: path.resolve(__dirname),
  },

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
