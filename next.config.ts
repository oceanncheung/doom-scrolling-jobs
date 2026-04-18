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
  // pdf-parse ships a CJS bundle + worker files and is loaded via a dynamic
  // `await import(...)` in lib/files/extract-uploaded-document-text.ts (path built from
  // process.cwd()). Next.js/Turbopack's static bundler can't analyze that dynamic path
  // and throws "Cannot find module as expression is too dynamic" at runtime — which
  // surfaced as a 1-second fast-fail on Generate Profile with no visible error (see
  // Alvis repro 2026-04-18). Marking pdf-parse as an external package keeps its CJS
  // resolution at Node runtime, not at bundle time.
  serverExternalPackages: ['pdf-parse'],
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
