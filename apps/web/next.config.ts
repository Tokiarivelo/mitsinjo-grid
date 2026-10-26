import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mitsinjo/engine'],
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', '@react-three/drei'],
  },
};

export default nextConfig;
