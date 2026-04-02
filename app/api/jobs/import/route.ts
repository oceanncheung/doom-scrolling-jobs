import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { hasSupabaseServerEnv } from '@/lib/env'
import {
  ensurePrimaryImportedJobs,
  primaryImportedSourceName,
} from '@/lib/jobs/real-feed'

export async function GET() {
  return NextResponse.json({
    envReady: hasSupabaseServerEnv(),
    primarySource: primaryImportedSourceName,
    source: 'source-expansion-v1',
    status: hasSupabaseServerEnv() ? 'ready' : 'missing-env',
    timestamp: new Date().toISOString(),
  })
}

export async function POST() {
  if (!hasSupabaseServerEnv()) {
    return NextResponse.json(
      {
        envReady: false,
        issue: 'Supabase server environment variables are required before imported jobs can be refreshed.',
        primarySource: primaryImportedSourceName,
        source: 'source-expansion-v1',
        status: 'missing-env',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }

  const result = await ensurePrimaryImportedJobs({
    force: true,
    markMissingAsStale: true,
  })

  revalidatePath('/dashboard')
  revalidatePath('/jobs/[jobId]', 'page')

  return NextResponse.json(
    {
      ...result,
      primarySource: primaryImportedSourceName,
      source: 'source-expansion-v1',
      status: result.issue ? 'completed-with-issue' : 'ok',
      timestamp: new Date().toISOString(),
    },
    {
      status: result.issue ? 207 : 200,
    },
  )
}
