/** @type {import("next").NextConfig} */
const nextConfig = {
  experimental: {
    // Workspace packages are imported from ../../packages via tsconfig paths (exFAT: no symlinks).
    externalDir: true,
    // Keep webpack in the main process so the preloaded scripts/exfat-fs-patch.cjs applies to it.
    webpackBuildWorker: false,
  },
  webpack(config) {
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
