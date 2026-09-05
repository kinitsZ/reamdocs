import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Silences a Turbopack warning: there's an unrelated stray package-lock.json one
  // directory up (outside this git repo), which Turbopack otherwise mistakes for a
  // monorepo root.
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
