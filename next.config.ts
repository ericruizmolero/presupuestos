import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['firebase', '@firebase/auth', '@firebase/firestore', '@firebase/storage', '@firebase/app'],
  async redirects() {
    return [
      // Legacy /p/[slug] → /client/[slug]
      { source: '/p/:slug', destination: '/client/:slug', permanent: true },
    ]
  },
};

export default nextConfig;
