'use client'

import type { ReactNode } from 'react'

import { ReviewStateIndicator } from '@/components/profile/review-state-indicator'
import type { ReviewState } from '@/lib/profile/master-assets'

interface FieldLabelRowProps {
  children: ReactNode
  className?: string
  labelClassName?: string
  reviewState?: ReviewState
}

export function FieldLabelRow({
  children,
  className,
  labelClassName,
  reviewState,
}: FieldLabelRowProps) {
  return (
    <span className={['field-label-row', className].filter(Boolean).join(' ')}>
      <span className={labelClassName}>{children}</span>
      {reviewState ? <ReviewStateIndicator state={reviewState} /> : null}
    </span>
  )
}
