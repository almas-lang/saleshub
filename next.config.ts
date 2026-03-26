import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: [
    "d3-timer",
    "d3-transition",
    "d3-zoom",
    "d3-interpolate",
    "d3-selection",
    "d3-dispatch",
    "d3-ease",
    "d3-color",
  ],
  webpack: (config) => {
    // Fix @react-email/tailwind failing to resolve named exports from
    // sibling @react-email/* packages (Hr, Img) during webpack bundling.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-email/hr": path.resolve("node_modules/@react-email/hr"),
      "@react-email/img": path.resolve("node_modules/@react-email/img"),
    };
    return config;
  },
};

export default nextConfig;
