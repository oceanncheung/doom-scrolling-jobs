'use client'

import { ReviewStateIndicator } from '@/components/profile/review-state-indicator'
import type { ReviewState } from '@/lib/profile/master-assets'

interface TagToggleGroupOption {
  label: string
  value: string
}

interface TagToggleGroupProps {
  helper?: string
  label: string
  onChange: (values: string[]) => void
  options: TagToggleGroupOption[]
  reviewState?: ReviewState
  values: string[]
}

export function TagToggleGroup({
  helper,
  label,
  onChange,
  options,
  reviewState,
  values,
}: TagToggleGroupProps) {
  const selectedValues = new Set(values)

  function toggleValue(value: string) {
    if (selectedValues.has(value)) {
      onChange(values.filter((item) => item !== value))
      return
    }

    onChange([...values, value])
  }

  return (
    <div className={`field tag-input-field${reviewState ? ` field--${reviewState}` : ''}`}>
      <span className="field-label-row">
        <span>{label}</span>
        {reviewState ? <ReviewStateIndicator state={reviewState} /> : null}
      </span>
      <div className="tag-toggle-group">
        {options.map((option) => {
          const isSelected = selectedValues.has(option.value)

          return (
            <button
              aria-pressed={isSelected}
              className={`tag-toggle-chip${isSelected ? ' is-selected' : ''}`}
              key={option.value}
              onClick={() => toggleValue(option.value)}
              type="button"
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {helper ? <small>{helper}</small> : null}
    </div>
  )
}
