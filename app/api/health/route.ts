import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    service: 'doomscrollingjobs-web',
    status: 'ok',
    phase: 'foundation',
    timestamp: new Date().toISOString(),
  })
}
