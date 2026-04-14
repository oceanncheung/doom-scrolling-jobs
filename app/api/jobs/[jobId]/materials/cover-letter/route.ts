import { getApplicationPacketReview } from '@/lib/data/application-packets'
import { buildCoverLetterDocxBuffer } from '@/lib/jobs/packet-material-export'
import { buildCoverLetterMaterialReview } from '@/lib/jobs/packet-materials'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{
    jobId: string
  }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { jobId } = await params
  const review = await getApplicationPacketReview(jobId)

  if (!review.job || !review.packet) {
    return Response.json({ error: 'The requested packet could not be found.' }, { status: 404 })
  }

  const materialReview = buildCoverLetterMaterialReview({
    companyName: review.job.companyName,
    jobId: review.job.id,
    jobTitle: review.job.title,
    packet: review.packet,
    workspace: review.workspace,
  })

  const buffer = await buildCoverLetterDocxBuffer({
    job: review.job,
    packet: review.packet,
    workspace: review.workspace,
  })

  return new Response(Uint8Array.from(buffer), {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${materialReview.downloadFileName}"`,
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
  })
}
