import { redirect } from 'next/navigation'

import { requireActiveOperatorSelection } from '@/lib/data/operators'
import { getJobReviewHref } from '@/lib/jobs/review-navigation'

export const dynamic = 'force-dynamic'

interface PacketReviewPageProps {
  params: Promise<{
    jobId: string
  }>
}

/** Packet prep lives on `/jobs/[jobId]`; keep this route as a redirect for bookmarks and old links. */
export default async function PacketReviewPage({ params }: PacketReviewPageProps) {
  await requireActiveOperatorSelection()
  const { jobId } = await params
  redirect(getJobReviewHref(jobId))
}
