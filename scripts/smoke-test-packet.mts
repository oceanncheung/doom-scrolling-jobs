import { hasSupabaseServerEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

import { fetchSmoke, getSmokeBaseUrl, getSmokeJobId, getSmokeOperatorId } from './smoke-helpers.mts'

const baseUrl = getSmokeBaseUrl()
const jobId = getSmokeJobId(process.argv[2])
const packetPath = `/jobs/${jobId}/packet`

/**
 * The packet smoke expects the target job to be in a "prep-open" workflow state (shortlisted,
 * preparing, or ready_to_apply) so the review page renders the "Generate Materials" button. The
 * fixture isn't seeded by any migration — the smoke owns its own setup/restore so the operator's
 * queue state isn't permanently rewritten by CI runs.
 */
async function ensurePrepOpen(): Promise<{ restore: () => Promise<void> } | null> {
  if (!hasSupabaseServerEnv()) {
    return null
  }

  const operatorId = await getSmokeOperatorId()
  const supabase = createClient()

  const { data: score, error: readError } = await supabase
    .from('job_scores')
    .select('workflow_status')
    .eq('user_id', operatorId)
    .eq('job_id', jobId)
    .maybeSingle()

  if (readError) {
    throw new Error(`Packet smoke: failed to read fixture job state: ${readError.message}`)
  }

  if (!score) {
    // No row for this operator + job pairing — let the smoke run so its own checks fail with a
    // clearer signal than "silent fixture mismatch".
    return null
  }

  const originalStatus = score.workflow_status
  const prepOpenStatuses = new Set(['shortlisted', 'preparing', 'ready_to_apply'])

  if (prepOpenStatuses.has(originalStatus)) {
    return null
  }

  const { error: setError } = await supabase
    .from('job_scores')
    .update({ workflow_status: 'preparing' })
    .eq('user_id', operatorId)
    .eq('job_id', jobId)

  if (setError) {
    throw new Error(`Packet smoke: failed to prepare fixture state: ${setError.message}`)
  }

  return {
    restore: async () => {
      const { error: restoreError } = await supabase
        .from('job_scores')
        .update({ workflow_status: originalStatus })
        .eq('user_id', operatorId)
        .eq('job_id', jobId)

      if (restoreError) {
        console.error(
          `Packet smoke: failed to restore fixture workflow_status to ${originalStatus}: ${restoreError.message}`,
        )
      }
    },
  }
}

async function runSmoke() {
  const redirectResponse = await fetchSmoke(packetPath, {
    redirect: 'manual',
  })
  const redirectLocation = redirectResponse.headers.get('location')
  const resolvedReviewPath = redirectLocation || `/jobs/${jobId}`
  const reviewResponse = await fetchSmoke(resolvedReviewPath, {
    redirect: 'follow',
  })
  const reviewHtml = await reviewResponse.text()

  const markers = {
    applicationMaterials: reviewHtml.includes('Application materials'),
    applicationQuestions: reviewHtml.includes('Application questions'),
    generateMaterials: />\s*Generate Materials\s*</.test(reviewHtml),
    jobOverview: reviewHtml.includes('Job overview'),
    markReady: />\s*Mark Ready\s*</.test(reviewHtml),
    prepare: />\s*Prepare\s*</.test(reviewHtml) || />\s*Continue prep\s*</.test(reviewHtml),
    reviewTitle: reviewHtml.includes('Review what will be sent.'),
  }
  const passed =
    [307, 308].includes(redirectResponse.status) &&
    reviewResponse.status === 200 &&
    markers.generateMaterials &&
    !markers.markReady &&
    !markers.prepare &&
    markers.jobOverview

  console.log(
    JSON.stringify(
      {
        baseUrl,
        jobId,
        passed,
        packetPath,
        redirectLocation,
        redirectStatus: redirectResponse.status,
        reviewPath: resolvedReviewPath,
        reviewStatus: reviewResponse.status,
        markers,
      },
      null,
      2,
    ),
  )

  return passed
}

const fixture = await ensurePrepOpen()
let passed = false

try {
  passed = await runSmoke()
} finally {
  if (fixture) {
    await fixture.restore()
  }
}

if (!passed) {
  process.exit(1)
}
