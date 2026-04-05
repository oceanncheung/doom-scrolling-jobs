'use client'

import type { KeyboardEvent } from 'react'
import { useId, useRef, useState } from 'react'

import { FieldLabelRow } from '@/components/ui/field-label-row'
import { ChevronDownIcon } from '@/components/ui/icons/chevron-down-icon'
import { PlusIcon } from '@/components/ui/icons/plus-icon'
import { getOverlayPlacement, type OverlayPlacement } from '@/lib/profile/overlay-placement'
import type { ReviewState } from '@/lib/profile/master-assets'

interface TagInputProps {
  helper?: string
  label: string
  onChange: (tags: string[]) => void
  placeholder?: string
  preserveCase?: boolean
  reviewState?: ReviewState
  suggestions?: string[]
  tags: string[]
  /** `square`: 30×30 cells (+ becomes caret-ready input; new cell after each Enter). `field`: full-width underline input. */
  variant?: 'field' | 'square'
}

export function TagInput({
  helper,
  label,
  onChange,
  placeholder,
  preserveCase = false,
  reviewState,
  suggestions,
  tags,
  variant = 'field',
}: TagInputProps) {
  const isSquare = variant === 'square'
  const [input, setInput] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showAllSquareSuggestions, setShowAllSquareSuggestions] = useState(false)
  const [squareSuggestionPlacement, setSquareSuggestionPlacement] =
    useState<OverlayPlacement>('below')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const suggestionsId = useId()
  const availableSuggestions =
    suggestions?.filter(
      (suggestion, index, values) =>
        suggestion.trim().length > 0 &&
        values.findIndex((value) => value.toLowerCase() === suggestion.toLowerCase()) === index &&
        !tags.some((tag) => tag.toLowerCase() === suggestion.toLowerCase()),
    ) ?? []

  function commitTag(rawValue: string) {
    const raw = rawValue.trim()

    if (!raw) {
      return false
    }

    const exactSuggestion = availableSuggestions.find(
      (suggestion) => suggestion.toLowerCase() === raw.toLowerCase(),
    )
    const nextTag = exactSuggestion ?? (preserveCase ? raw : raw.toLowerCase())
    const duplicate = tags.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())

    if (!duplicate) {
      onChange([...tags, nextTag])
    }

    setInput('')
    setSquareSuggestionPlacement('below')
    setShowAllSquareSuggestions(false)

    return !duplicate
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && !input.trim()) {
      setIsEditing(false)
      setShowAllSquareSuggestions(false)

      return
    }

    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      commitTag(input)
      setIsEditing(false)
    }

    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  function removeTag(i: number) {
    onChange(tags.filter((_, idx) => idx !== i))
  }

  function beginEditing() {
    setIsEditing(true)
    setShowAllSquareSuggestions(false)

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  function toggleSquareSuggestions() {
    const nextShowAll = !showAllSquareSuggestions
    setShowAllSquareSuggestions(nextShowAll)

    if (!isEditing) {
      setIsEditing(true)
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  const needsInput = tags.length === 0
  /** Idle trailing slot: + control; click → type → Enter → back to + for the next item */
  const showAddButton = !isEditing && !input.trim()
  const hasDatalist = availableSuggestions.length > 0
  const showSquareSuggestionField = isSquare && hasDatalist && !showAddButton
  const filteredSquareSuggestions = showSquareSuggestionField
    ? input.trim()
      ? availableSuggestions.filter((suggestion) =>
          suggestion.toLowerCase().includes(input.trim().toLowerCase()),
        )
      : showAllSquareSuggestions
        ? availableSuggestions
        : []
    : []
  const showSquareSuggestionPanel =
    showSquareSuggestionField && filteredSquareSuggestions.length > 0

  function handleSquareSuggestionPanelRef(node: HTMLDivElement | null) {
    panelRef.current = node

    if (!node || !containerRef.current) {
      if (squareSuggestionPlacement !== 'below') {
        setSquareSuggestionPlacement('below')
      }
      return
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    const panelRect = node.getBoundingClientRect()
    const nextPlacement = getOverlayPlacement(
      containerRect,
      panelRect.height,
      window.innerHeight,
    )

    if (nextPlacement !== squareSuggestionPlacement) {
      setSquareSuggestionPlacement(nextPlacement)
    }
  }

  const tagInputEl = (
    <input
      aria-label={
        tags.length > 0 ? `Add another ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`
      }
      className={isSquare ? 'tag-input tag-input-square' : 'tag-input'}
      list={hasDatalist && !isSquare ? suggestionsId : undefined}
      onBlur={() => {
        requestAnimationFrame(() => {
          if (containerRef.current?.contains(document.activeElement)) {
            return
          }

          if (!input.trim()) {
            setIsEditing(false)
            setShowAllSquareSuggestions(false)

            return
          }

          const exactSuggestion = availableSuggestions.find(
            (suggestion) => suggestion.toLowerCase() === input.trim().toLowerCase(),
          )

          if (exactSuggestion) {
            commitTag(exactSuggestion)
            setIsEditing(false)
            return
          }
        })
      }}
      onChange={(e) => {
        const nextValue = e.target.value
        setInput(nextValue)
        setShowAllSquareSuggestions(false)

        const exactSuggestion = availableSuggestions.find(
          (suggestion) => suggestion.toLowerCase() === nextValue.trim().toLowerCase(),
        )

        if (exactSuggestion) {
          commitTag(exactSuggestion)
          setIsEditing(false)
        }
      }}
      onKeyDown={handleKeyDown}
      placeholder={
        isSquare
          ? ''
          : tags.length > 0
            ? 'Add another…'
            : (placeholder ?? 'Type and press Enter')
      }
      ref={inputRef}
      size={isSquare ? Math.max(1, Math.min(80, input.length + 1)) : undefined}
      type="text"
      value={input}
    />
  )

  return (
    <div
      className={`field tag-input-field${needsInput ? ' field--needs-input' : ''}${reviewState ? ` field--${reviewState}` : ''}`}
    >
      <FieldLabelRow reviewState={reviewState}>{label}</FieldLabelRow>
      <div
        className={`tag-input-container${isSquare ? ' tag-input-container--square' : ''}`}
        ref={containerRef}
      >
        <div className="tag-list">
          {tags.map((tag, i) => (
            <button
              aria-label={`Remove ${tag}`}
              className="tag-chip"
              key={`${i}-${tag}`}
              onClick={() => removeTag(i)}
              type="button"
            >
              {tag}
              <span aria-hidden className="tag-chip-x">
                ×
              </span>
            </button>
          ))}
          {showAddButton ? (
            <button
              aria-label={
                tags.length > 0
                  ? `Add another ${label.toLowerCase()}`
                  : `Add ${label.toLowerCase()}`
              }
              className="tag-add-trigger"
              onClick={beginEditing}
              type="button"
            >
              <PlusIcon className="tag-add-icon" />
            </button>
          ) : showSquareSuggestionField ? (
            <span className="tag-input-square-trigger">
              {tagInputEl}
              <button
                aria-label={`Show all ${label.toLowerCase()} options`}
                className="tag-input-square-trigger__button"
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                onClick={toggleSquareSuggestions}
                type="button"
              >
                <span aria-hidden className="tag-input-square-trigger__chevron">
                  <ChevronDownIcon />
                </span>
              </button>
            </span>
          ) : hasDatalist && !isSquare ? (
            <span className="list-input-shell tag-input-datalist-wrap tag-input-datalist-wrap--field">
              {tagInputEl}
              <span aria-hidden className="list-input-shell__chevron">
                <ChevronDownIcon />
              </span>
            </span>
          ) : (
            tagInputEl
          )}
        </div>
        {showSquareSuggestionPanel ? (
          <div
            className={`overlay-option-panel${squareSuggestionPlacement === 'above' ? ' is-above' : ''}`}
            ref={handleSquareSuggestionPanelRef}
            role="listbox"
          >
            {filteredSquareSuggestions.map((suggestion) => (
              <button
                className="overlay-option-item"
                key={suggestion}
                onMouseDown={(event) => {
                  event.preventDefault()
                  commitTag(suggestion)
                  setIsEditing(false)
                }}
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {hasDatalist ? (
        <datalist id={suggestionsId}>
          {availableSuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}
      {helper ? <small>{helper}</small> : null}
    </div>
  )
}
