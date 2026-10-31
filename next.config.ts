import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // A self-contained server (server.js + the modules it uses) for the Docker image.
  output: "standalone",
  // A second local instance (another model or Norba setup) builds into its own folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
