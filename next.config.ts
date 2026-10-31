import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // A second local instance (another model or Norba setup) builds into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
