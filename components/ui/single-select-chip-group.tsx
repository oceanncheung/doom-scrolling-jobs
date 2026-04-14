'use client'

import { FieldLabelRow } from '@/components/ui/field-label-row'

interface SingleSelectChipGroupOption {
  helper?: string
  label: string
  value: string
}

interface SingleSelectChipGroupProps {
  hideLabel?: boolean
  label: string
  onChange: (value: string) => void
  options: SingleSelectChipGroupOption[]
  value: string
}

export function SingleSelectChipGroup({
  hideLabel = false,
  label,
  onChange,
  options,
  value,
}: SingleSelectChipGroupProps) {
  const selectedOption = options.find((option) => option.value === value)

  return (
    <div
      aria-label={hideLabel ? label : undefined}
      className="field tag-input-field"
      role={hideLabel ? 'group' : undefined}
    >
      {hideLabel ? null : <FieldLabelRow>{label}</FieldLabelRow>}
      <div className="tag-toggle-group">
        {options.map((option) => {
          const isSelected = option.value === value

          return (
            <button
              aria-pressed={isSelected}
              className={`tag-toggle-chip${isSelected ? ' is-selected' : ''}`}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {selectedOption?.helper ? <small>{selectedOption.helper}</small> : null}
    </div>
  )
}
