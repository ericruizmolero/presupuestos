import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['firebase', '@firebase/auth', '@firebase/firestore', '@firebase/storage', '@firebase/app'],
};

export default nextConfig;
