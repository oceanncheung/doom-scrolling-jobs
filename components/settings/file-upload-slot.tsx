'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { TrashIcon } from '@/components/ui/icons/trash-icon'
import { UploadIcon } from '@/components/ui/icons/upload-icon'
import {
  formatCompactFileName,
  formatCompactMiddleText,
} from '@/lib/files/format-compact-file-name'

interface FileUploadSlotProps {
  accept?: string
  compactMaxLength?: number
  fileName?: string | null
  inputName?: string
  label: string
  onRemove: () => void
  onUpload: (file: File) => void
  showUploadIcon?: boolean
}

export function FileUploadSlot({
  accept = '.pdf',
  compactMaxLength = 30,
  fileName,
  inputName,
  label,
  onRemove,
  onUpload,
  showUploadIcon = false,
}: FileUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const chipRef = useRef<HTMLButtonElement | null>(null)
  const [dynamicCompactLength, setDynamicCompactLength] = useState(compactMaxLength)

  useEffect(() => {
    const node = chipRef.current

    if (!node || typeof ResizeObserver === 'undefined') {
      return
    }

    const updateLength = () => {
      const width = node.getBoundingClientRect().width
      const iconAllowance = showUploadIcon || fileName ? 54 : 24
      const nextLength = Math.max(
        12,
        Math.min(40, Math.floor((width - iconAllowance) / 8.4)),
      )

      setDynamicCompactLength((current) =>
        current === nextLength ? current : nextLength,
      )
    }

    updateLength()

    const observer = new ResizeObserver(() => {
      updateLength()
    })

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [compactMaxLength, fileName, showUploadIcon])

  const compactFileName = useMemo(
    () => (fileName ? formatCompactFileName(fileName, dynamicCompactLength) : ''),
    [dynamicCompactLength, fileName],
  )
  const compactLabel = useMemo(
    () => formatCompactMiddleText(label, dynamicCompactLength),
    [dynamicCompactLength, label],
  )

  return (
    <div className="upload-slot upload-slot--chip">
      {fileName ? (
        <button
          aria-label={`Remove ${label}`}
          className="upload-slot-chip-btn upload-slot-chip-btn--filled"
          onClick={() => {
            if (inputRef.current) {
              inputRef.current.value = ''
            }
            onRemove()
          }}
          ref={chipRef}
          title={fileName}
          type="button"
        >
          <span className="upload-slot-chip-filename">{compactFileName}</span>
          <span className="upload-slot-chip-trailing-icon">
            <TrashIcon className="upload-slot-chip-icon-svg" />
          </span>
        </button>
      ) : (
        <button
          className="upload-slot-chip-btn"
          onClick={() => inputRef.current?.click()}
          ref={chipRef}
          type="button"
        >
          {showUploadIcon ? (
            <>
              <span className="upload-slot-chip-label">{compactLabel}</span>
              <span className="upload-slot-chip-trailing-icon">
                <UploadIcon className="upload-slot-chip-icon-svg" />
              </span>
            </>
          ) : (
            <span>{compactLabel}</span>
          )}
        </button>
      )}
      <input
        accept={accept}
        hidden
        name={inputName}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            onUpload(f)
          }
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  )
}
