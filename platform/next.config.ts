import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB. The athlete photo picker crops/re-encodes client-side
      // to ~80KB, but a device where that step behaves unexpectedly (older
      // Safari, a very large source image) could still post something bigger
      // than the default allows — and a request over the limit is rejected
      // before the action even runs, which looked like "Save does nothing."
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
