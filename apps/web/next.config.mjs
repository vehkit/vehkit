/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lfgypksfhcuslqqangxi.supabase.co' },
    ],
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
