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
}

export default nextConfig
