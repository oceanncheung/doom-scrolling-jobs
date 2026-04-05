'use client'

import type { ReviewState } from '@/lib/profile/master-assets'
import { useProfileReviewIndicators } from '@/components/profile/profile-save-message-root'

function getReviewStateLabel(state: ReviewState) {
  return state === 'ready' ? 'Ready' : 'Needs attention'
}

export function ReviewStateIndicator({
  className,
  state,
}: {
  className?: string
  state: ReviewState
}) {
  const { reviewIndicatorsVisible } = useProfileReviewIndicators()
  const tone = state === 'ready' ? 'is-ready' : 'is-attention'

  if (!reviewIndicatorsVisible) {
    return null
  }

  return (
    <span
      aria-label={getReviewStateLabel(state)}
      className={['settings-review-indicator', tone, className].filter(Boolean).join(' ')}
      role="status"
      title={getReviewStateLabel(state)}
    />
  )
}
