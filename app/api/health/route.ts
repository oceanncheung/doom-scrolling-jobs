import { NextResponse } from 'next/server'

import { appMode } from '@/lib/config/runtime'

export function GET() {
  return NextResponse.json({
    service: 'doomscrollingjobs-web',
    status: 'ok',
    phase: 'foundation',
    mode: appMode,
    timestamp: new Date().toISOString(),
  })
}
