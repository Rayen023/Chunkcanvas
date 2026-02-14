import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // External packages that should not be bundled server-side
  serverExternalPackages: ["pdfjs-dist", "pdf-lib", "chromadb"],

  webpack: (config, { isServer }) => {
    // pdf-parse uses "fs" which is not available in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    // Ensure canvas (optional pdfjs dep) doesn't break the build
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }

    return config;
  },
};

export default nextConfig;
