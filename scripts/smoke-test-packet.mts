import { fetchSmoke, getSmokeBaseUrl, getSmokeJobId } from './smoke-helpers.mts'

const baseUrl = getSmokeBaseUrl()
const jobId = getSmokeJobId(process.argv[2])
const packetPath = `/jobs/${jobId}/packet`
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

if (!passed) {
  process.exit(1)
}
