import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // "output: export" removido — el proyecto ahora tiene API routes server-side
  // (proxy MikroTik RouterOS). Desplegar en Vercel o VPS con Node.js.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
