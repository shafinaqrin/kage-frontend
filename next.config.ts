import type { NextConfig } from 'next'

const backendHost = process.env.BACKEND_HOST ?? 'localhost'
const backendPort = process.env.BACKEND_PORT ?? '3000'

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [{ source: '/api/:path*', destination: `http://${backendHost}:${backendPort}/api/:path*` }]
  },
  /**
   * Never let the HTML document be cached.
   *
   * The dashboard is a client-side shell, so Next.js prerenders it as static
   * and stamps the response `s-maxage=31536000` — a *one year* freshness
   * lifetime, meant for a CDN fronting a page that changes yearly. For this app
   * it is actively wrong: every `make frontend` produces a new shell, and a
   * browser holding the old one keeps rendering the previous build with no
   * request to the server at all, so a deploy looks like it did nothing.
   *
   * `no-cache` (not `no-store`) is deliberate — it means "revalidate before
   * using" rather than "never keep this". The ETag above still lets an
   * unchanged build answer with a cheap 304, so the browser stays correct
   * without re-downloading the shell on every navigation.
   *
   * Scoped to `/` only: the fingerprinted `/_next/static/*` assets are
   * content-addressed and *should* stay immutable.
   */
  async headers() {
    return [
      {
        source: '/',
        headers: [{ key: 'Cache-Control', value: 'no-cache, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
