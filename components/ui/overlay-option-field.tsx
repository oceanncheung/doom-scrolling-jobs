'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { getOverlayPlacement, type OverlayPlacement } from '@/lib/profile/overlay-placement'

interface OverlayOption {
  label: string
  value: string
}

interface OverlayOptionFieldProps {
  ariaLabel: string
  defaultValue?: string
  form?: string
  name: string
  openBehavior: 'click' | 'type'
  options: OverlayOption[]
  placeholder?: string
  triggerVariant: 'underline-button' | 'underline-search'
}

export function OverlayOptionField({
  ariaLabel,
  defaultValue,
  form,
  name,
  openBehavior,
  options,
  placeholder,
  triggerVariant,
}: OverlayOptionFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isSearchable = triggerVariant === 'underline-search'
  const initialOption = options.find((option) => option.value === defaultValue)
  const [isOpen, setIsOpen] = useState(false)
  const [panelPlacement, setPanelPlacement] = useState<OverlayPlacement>('below')
  const [selectedValue, setSelectedValue] = useState(defaultValue ?? '')
  const [query, setQuery] = useState(initialOption?.label ?? defaultValue ?? '')
  const [showAllOptions, setShowAllOptions] = useState(false)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (!rootRef.current?.contains(target)) {
        setIsOpen(false)
        setShowAllOptions(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [])

  const filteredOptions = useMemo(() => {
    if (!isSearchable) {
      return options
    }

    const normalized = query.trim().toLowerCase()

    if (!normalized) {
      return showAllOptions ? options : []
    }

    return options.filter((option) => option.label.toLowerCase().includes(normalized))
  }, [isSearchable, options, query, showAllOptions])

  function handlePanelRef(node: HTMLDivElement | null) {
    panelRef.current = node

    if (!node || !rootRef.current) {
      if (panelPlacement !== 'below') {
        setPanelPlacement('below')
      }
      return
    }

    const rootRect = rootRef.current.getBoundingClientRect()
    const panelRect = node.getBoundingClientRect()
    const nextPlacement = getOverlayPlacement(rootRect, panelRect.height, window.innerHeight)

    if (nextPlacement !== panelPlacement) {
      setPanelPlacement(nextPlacement)
    }
  }

  const displayedValue = isSearchable
    ? query
    : options.find((option) => option.value === selectedValue)?.label ?? ''

  const hiddenValue = isSearchable ? query : selectedValue

  function toggleSearchableOptions() {
    const nextShowAll = !showAllOptions || !isOpen
    setShowAllOptions(nextShowAll)
    setIsOpen(nextShowAll)

    if (nextShowAll) {
      requestAnimationFrame(() => {
        rootRef.current?.querySelector('input')?.focus()
      })
    }
  }

  return (
    <div className="overlay-option-field" ref={rootRef}>
      <input form={form} name={name} type="hidden" value={hiddenValue} />
      {isSearchable ? (
        <div className="overlay-option-control overlay-option-control--searchable">
          <input
            aria-label={ariaLabel}
            className="overlay-option-input"
            onChange={(event) => {
              const nextValue = event.target.value
              setQuery(nextValue)
              setShowAllOptions(false)
              setIsOpen(openBehavior === 'type' && nextValue.trim().length > 0)
            }}
            onBlur={() => {
              requestAnimationFrame(() => {
                if (!rootRef.current?.contains(document.activeElement)) {
                  setIsOpen(false)
                  setShowAllOptions(false)
                }
              })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsOpen(false)
                setShowAllOptions(false)
              }
            }}
            placeholder={placeholder}
            type="text"
            value={displayedValue}
          />
          <button
            aria-label={`Show all ${ariaLabel.toLowerCase()} options`}
            className="overlay-option-chevron-button"
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={toggleSearchableOptions}
            type="button"
          >
            <span aria-hidden className="overlay-option-chevron">
              <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
                <path
                  d="M3.25 4.5 6 7.25 8.75 4.5"
                  stroke="currentColor"
                  strokeLinecap="square"
                  strokeWidth="1.2"
                />
              </svg>
            </span>
          </button>
        </div>
      ) : (
        <div className="overlay-option-control overlay-option-control--button">
          <button
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-label={ariaLabel}
            className="overlay-option-button"
            onClick={() => {
              if (openBehavior === 'click') {
                setIsOpen((current) => !current)
              }
            }}
            type="button"
          >
            <span className={`overlay-option-button__label${displayedValue ? '' : ' is-placeholder'}`}>
              {displayedValue || placeholder}
            </span>
          </button>
          <span aria-hidden className="overlay-option-chevron">
            <svg fill="none" height="12" viewBox="0 0 12 12" width="12">
              <path
                d="M3.25 4.5 6 7.25 8.75 4.5"
                stroke="currentColor"
                strokeLinecap="square"
                strokeWidth="1.2"
              />
            </svg>
          </span>
        </div>
      )}
      {isOpen && filteredOptions.length > 0 ? (
        <div
          className={`overlay-option-panel${panelPlacement === 'above' ? ' is-above' : ''}`}
          ref={handlePanelRef}
          role="listbox"
        >
          {filteredOptions.map((option) => (
            <button
              className="overlay-option-item"
              key={option.value}
              onMouseDown={(event) => {
                event.preventDefault()
                setSelectedValue(option.value)
                setQuery(option.label)
                setIsOpen(false)
                setShowAllOptions(false)
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
