'use client'

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useCallback, useRef, useState } from 'react'

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
  const railRef = useRef<HTMLDivElement>(null)
  const [railDragging, setRailDragging] = useState(false)

  const selectedOption = options.find((option) => option.value === value)
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  )
  const sliderStyle = {
    '--single-select-slider-count': options.length,
    '--single-select-slider-index': selectedIndex,
  } as CSSProperties

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const el = railRef.current
      const n = options.length
      if (!el || n === 0) {
        return 0
      }
      const rect = el.getBoundingClientRect()
      const t = (clientX - rect.left) / rect.width
      const clamped = Math.min(1, Math.max(0, t))
      if (n === 1) {
        return 0
      }
      return Math.min(n - 1, Math.max(0, Math.round(clamped * (n - 1))))
    },
    [options.length],
  )

  const selectIndex = useCallback(
    (clientX: number) => {
      const idx = indexFromClientX(clientX)
      const next = options[idx]?.value
      if (next !== undefined && next !== value) {
        onChange(next)
      }
    },
    [indexFromClientX, onChange, options, value],
  )

  const onRailPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setRailDragging(true)
    selectIndex(event.clientX)
  }

  const onRailPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }
    selectIndex(event.clientX)
  }

  const onRailPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setRailDragging(false)
  }

  return (
    <div
      aria-label={hideLabel ? label : undefined}
      className="field tag-input-field"
      role={hideLabel ? 'group' : undefined}
    >
      {hideLabel ? null : <FieldLabelRow>{label}</FieldLabelRow>}
      <div
        aria-label={label}
        className="single-select-slider"
        role="radiogroup"
        style={sliderStyle}
      >
        <div
          aria-hidden="true"
          className={`single-select-slider-rail${railDragging ? ' is-dragging' : ''}`}
          onPointerCancel={onRailPointerUp}
          onPointerDown={onRailPointerDown}
          onPointerMove={onRailPointerMove}
          onPointerUp={onRailPointerUp}
          ref={railRef}
        >
          <span className="single-select-slider-track" />
          <span className="single-select-slider-thumb" />
        </div>
        <div className="single-select-slider-options">
          {options.map((option) => {
            const isSelected = option.value === value

            return (
              <button
                aria-checked={isSelected}
                className={`single-select-slider-button${isSelected ? ' is-selected' : ''}`}
                key={option.value}
                onClick={() => onChange(option.value)}
                role="radio"
                type="button"
              >
                <span className="single-select-slider-button-label">{option.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      {selectedOption?.helper ? <small>{selectedOption.helper}</small> : null}
    </div>
  )
}
