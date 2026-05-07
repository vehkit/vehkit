/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lfgypksfhcuslqqangxi.supabase.co' },
    ],
  },
}

export default nextConfig
