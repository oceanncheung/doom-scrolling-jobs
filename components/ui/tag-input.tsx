'use client'

import type { KeyboardEvent } from 'react'
import { useRef, useState } from 'react'

interface TagInputProps {
  helper?: string
  label: string
  onChange: (tags: string[]) => void
  placeholder?: string
  preserveCase?: boolean
  tags: string[]
}

export function TagInput({
  helper,
  label,
  onChange,
  placeholder,
  preserveCase = false,
  tags,
}: TagInputProps) {
  const [input, setInput] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && !input.trim()) {
      setIsEditing(false)
      return
    }

    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      const raw = input.trim()
      const newTag = preserveCase ? raw : raw.toLowerCase()
      const duplicate = tags.some((t) => t.toLowerCase() === newTag.toLowerCase())
      if (!duplicate) {
        onChange([...tags, newTag])
      }
      setInput('')
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
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

    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }

  return (
    <div className="field tag-input-field">
      <span>{label}</span>
      <div className="tag-input-container">
        {tags.length > 0 ? (
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
          </div>
        ) : null}
        {isEditing || input ? (
          <input
            className="tag-input"
            onBlur={() => {
              if (!input.trim()) {
                setIsEditing(false)
              }
            }}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? 'Type and press Enter'}
            ref={inputRef}
            type="text"
            value={input}
          />
        ) : (
          <button
            aria-label={`Add ${label.toLowerCase()}`}
            className="tag-add-trigger"
            onClick={beginEditing}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="tag-add-icon"
              fill="none"
              height="14"
              viewBox="0 0 14 14"
              width="14"
            >
              <path d="M7 3V11" stroke="currentColor" strokeLinecap="square" strokeWidth="1.2" />
              <path d="M3 7H11" stroke="currentColor" strokeLinecap="square" strokeWidth="1.2" />
            </svg>
          </button>
        )}
      </div>
      {helper ? <small>{helper}</small> : null}
    </div>
  )
}
