import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const LONG_LIVED_ASSET_CACHE_CONTROL =
  'public, max-age=31536000, s-maxage=31536000, immutable'

const nextConfig: NextConfig = {
  async headers() {
    return [
      ...[
        '/api/sermon-audio/file/:path*',
        '/api/media/file/:path*',
        '/images/ev_church_podcast-09e38534.jpg',
      ].map((source) => ({
        source,
        headers: [
          { key: 'Cache-Control', value: LONG_LIVED_ASSET_CACHE_CONTROL },
          {
            key: 'Cloudflare-CDN-Cache-Control',
            value: LONG_LIVED_ASSET_CACHE_CONTROL,
          },
        ],
      })),
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // Retired staging host → canonical production host
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'new.ev.church' }],
        destination: 'https://www.ev.church/:path*',
        permanent: true,
      },
      {
        source: '/connect',
        destination: '/?launcher=connect',
        permanent: true,
      },
      // Old campus URLs → new slug-based URLs
      { source: '/campus/2', destination: '/campus/north', permanent: true },
      {
        source: '/campus/3',
        destination: '/campus/central',
        permanent: true,
      },
      {
        source: '/campus/4',
        destination: '/campus/unichurch',
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      // Railway S3 bucket
      ...(process.env.S3_ENDPOINT
        ? [
            {
              protocol: 'https' as const,
              hostname: new URL(process.env.S3_ENDPOINT).hostname,
            },
          ]
        : []),
      // Rock RMS images
      {
        protocol: 'https' as const,
        hostname: 'rock.ev.church',
      },
    ],
  },
}

export default withPayload(nextConfig)
