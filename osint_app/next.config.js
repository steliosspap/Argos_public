/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['three', 'react-globe.gl', '@react-three/fiber', '@react-three/drei'],
  experimental: {
    serverComponentsExternalPackages: ['mapbox-gl'],
  },
}

module.exports = nextConfig