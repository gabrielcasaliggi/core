import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",      // Genera /out estático — compatible con Cloudflare Pages
  images: {
    unoptimized: true,   // Requerido para export estático
  },
};

export default nextConfig;
