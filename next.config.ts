import type { NextConfig } from 'next'

const localDevOrigins = [
  '127.0.0.1',
  '192.168.2.143',
  'localhost',
  '*.localhost',
  'cursor.sh',
  '*.cursor.sh',
  'cursor.com',
  '*.cursor.com',
]

const nextConfig: NextConfig = {
  // Cursor's local preview/browser can load localhost projects through a different host,
  // so we allow the common local and Cursor dev origins here.
  allowedDevOrigins: localDevOrigins,
  output: 'standalone',
  experimental: {
    serverActions: {
      // Profile generation accepts resume + cover letter + portfolio PDF uploads via
      // FormData. Next.js defaults to 1MB per server-action request, which rejects any
      // resume PDF heavier than that with a 413 before the action runs — producing a dead
      // screen with no useful error. 10MB covers a typical resume PDF with images and
      // embedded fonts (observed: 2-5MB) plus the cover letter + portfolio in the same
      // submission, with headroom.
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
