'use client'

import {
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'

import { AutoSizeTextarea } from '@/components/ui/auto-size-textarea'
import { normalizeListItemText } from '@/lib/profile/master-assets'

function ensureBaseRows(items: string[]) {
  return items.length > 0 ? [...items] : []
}

function ensureEditableRows(items: string[]) {
  const base = ensureBaseRows(items)
  return base[base.length - 1]?.trim() ? [...base, ''] : base
}

function normalizeRows(items: string[]) {
  return items.map((item) => normalizeListItemText(item)).filter(Boolean)
}

function serializeHiddenValue(items: string[]) {
  return normalizeRows(items)
    .map((item) => `• ${item}`)
    .join('\n')
}

interface BulletTextareaProps {
  className?: string
  items: string[]
  name: string
  onItemsChange: (items: string[]) => void
  placeholder?: string
  rows?: number
}

export function BulletTextarea({
  className,
  items,
  name,
  onItemsChange,
  placeholder,
}: BulletTextareaProps) {
  const [focusedWithin, setFocusedWithin] = useState(false)
  const [draftRows, setDraftRows] = useState<string[]>(() => ensureEditableRows(items))
  const rowRefs = useRef<Array<HTMLTextAreaElement | null>>([])
  const committedItems = useMemo(() => normalizeRows(items), [items])
  const displayedRows = focusedWithin ? ensureEditableRows(draftRows) : ensureBaseRows(committedItems)

  function pushRows(nextRows: string[]) {
    const editableRows = ensureEditableRows(nextRows)
    setDraftRows(editableRows)
    onItemsChange(normalizeRows(editableRows))
  }

  function focusRow(index: number, position: 'end' | number = 'end') {
    requestAnimationFrame(() => {
      const next = rowRefs.current[index]
      next?.focus()
      if (next) {
        const resolvedPosition = position === 'end' ? next.value.length : position
        next.setSelectionRange(resolvedPosition, resolvedPosition)
      }
    })
  }

  function replaceRow(index: number, nextValue: string) {
    const baseRows = focusedWithin ? ensureEditableRows(draftRows) : ensureEditableRows(committedItems)
    const nextRows = [...baseRows]
    nextRows[index] = nextValue
    pushRows(nextRows)
  }

  function splitIntoRows(value: string) {
    return String(value ?? '')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((item) => item.replace(/^[•·▪◦*]\s*/u, '').replace(/^-\s+(?!\d)/, ''))
  }

  function handleRowChange(index: number, rawValue: string) {
    const parts = splitIntoRows(rawValue)

    if (parts.length <= 1) {
      replaceRow(index, parts[0] ?? '')
      return
    }

    const baseRows = focusedWithin ? ensureEditableRows(draftRows) : ensureEditableRows(committedItems)
    const nextRows = [
      ...baseRows.slice(0, index),
      ...parts,
      ...baseRows.slice(index + 1),
    ]
    pushRows(nextRows)
  }

  function handleFocusCapture() {
    if (focusedWithin) {
      return
    }

    setDraftRows(ensureEditableRows(committedItems))
    setFocusedWithin(true)
  }

  function activateEmptyEditor() {
    if (focusedWithin || displayedRows.length > 0) {
      return
    }

    setDraftRows(ensureEditableRows(committedItems))
    setFocusedWithin(true)
    focusRow(0, 0)
  }

  function handleBlurCapture(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    setFocusedWithin(false)
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter') {
      if (!event.currentTarget.value.trim()) {
        event.preventDefault()
        return
      }

      event.preventDefault()

      const sourceRows = focusedWithin ? ensureEditableRows(draftRows) : ensureEditableRows(committedItems)
      const selectionStart = event.currentTarget.selectionStart ?? event.currentTarget.value.length
      const selectionEnd = event.currentTarget.selectionEnd ?? selectionStart
      const currentValue = sourceRows[index] ?? ''
      const before = currentValue.slice(0, selectionStart)
      const after = currentValue.slice(selectionEnd)
      const nextRows = [
        ...sourceRows.slice(0, index),
        before,
        after,
        ...sourceRows.slice(index + 1),
      ]

      pushRows(nextRows)
      focusRow(index + 1, 0)
      return
    }

    if (event.key === 'Backspace' && !event.currentTarget.value.trim()) {
      const sourceRows = focusedWithin ? ensureEditableRows(draftRows) : ensureEditableRows(committedItems)

      if (sourceRows.length <= 1) {
        return
      }

      const nextRows = sourceRows.filter((_, itemIndex) => itemIndex !== index)
      pushRows(nextRows)
      event.preventDefault()
      focusRow(Math.max(0, index - 1))
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData('text/plain')

    if (!pasted.includes('\n')) {
      return
    }

    event.preventDefault()
    const sourceRows = focusedWithin ? ensureEditableRows(draftRows) : ensureEditableRows(committedItems)
    const nextRows = [
      ...sourceRows.slice(0, index),
      ...splitIntoRows(pasted),
      ...sourceRows.slice(index + 1),
    ]
    pushRows(nextRows)
  }

  return (
    <div
      className={['bullet-list-editor', className].filter(Boolean).join(' ')}
      onBlurCapture={handleBlurCapture}
      onClick={activateEmptyEditor}
      onFocusCapture={handleFocusCapture}
    >
      <input name={name} type="hidden" value={serializeHiddenValue(displayedRows)} />
      {displayedRows.map((item, index) => (
        <div className="bullet-list-editor__row" key={`${index}-${focusedWithin ? 'edit' : 'view'}`}>
          <span aria-hidden className="bullet-list-editor__marker">
            •
          </span>
          <AutoSizeTextarea
            className="bullet-list-editor__input"
            onChange={(event) => handleRowChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            placeholder={index === displayedRows.length - 1 ? placeholder : undefined}
            ref={(node) => {
              rowRefs.current[index] = node
            }}
            value={item}
          />
        </div>
      ))}
    </div>
  )
}
