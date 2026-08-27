import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.financialmodelingprep.com" },
      { protocol: "https", hostname: "financialmodelingprep.com" },
    ],
  },
};

export default nextConfig;
