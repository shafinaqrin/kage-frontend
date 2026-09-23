import type { NextConfig } from 'next'

const backendHost = process.env.BACKEND_HOST ?? 'localhost'
const backendPort = process.env.BACKEND_PORT ?? '3000'

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/:path*', destination: `http://${backendHost}:${backendPort}/api/:path*` }]
  },
}

export default nextConfig
