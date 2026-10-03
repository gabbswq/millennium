const remotePatterns = []
try {
  const storage = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
  if (storage.protocol === 'https:' && !storage.username && !storage.password && !storage.port) {
    remotePatterns.push({ protocol: 'https', hostname: storage.hostname, pathname: '/storage/v1/object/public/**' })
  }
} catch { /* No remote image proxy until an approved storage origin exists. */ }

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.MILLENNIUM_E2E === 'true' ? '.next-e2e' : '.next',
  images: {
    remotePatterns,
  },
}

export default nextConfig
