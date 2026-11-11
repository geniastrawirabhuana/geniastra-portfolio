const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseHostname
try { supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined } catch {}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: supabaseHostname ? [{ protocol: 'https', hostname: supabaseHostname, pathname: '/storage/v1/object/public/portfolio-media/**' }] : [],
  },
}

export default nextConfig
