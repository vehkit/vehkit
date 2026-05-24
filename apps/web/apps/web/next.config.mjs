/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lfgypksfhcuslqqangxi.supabase.co' },
    ],
  },
  // Server Actions default to a 1 MB body limit. Insurance PDFs, mulkiya
  // scans, and vehicle hero photos routinely exceed that. 10 MB is the
  // sane upper bound — large enough for multi-page PDF scans, small
  // enough that abusive payloads still get rejected at the edge.
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async redirects() {
    return [
      // Old /garage URL → /mycars (preserves bookmarks, magic links, etc.)
      { source: '/garage', destination: '/mycars', permanent: true },
      { source: '/garage/:path*', destination: '/mycars/:path*', permanent: true },
    ]
  },
}

export default nextConfig
