'use client'

import { useRef } from 'react'

import { formatCompactFileName } from '@/lib/files/format-compact-file-name'

function TrashGlyph() {
  return (
    <svg aria-hidden className="upload-slot-chip-icon-svg" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path
        d="M4.25 4.5V10.25M7 4.5V10.25M9.75 4.5V10.25M3 3h8M5 3V2h4v1M4 12h6"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function UploadGlyph() {
  return (
    <svg aria-hidden className="upload-slot-chip-icon-svg" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path
        d="M7 10.5V3.5M4.5 6 7 3.5 9.5 6M3 11.5h8"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.2"
      />
    </svg>
  )
}

interface FileUploadSlotProps {
  accept?: string
  compactMaxLength?: number
  fileName?: string | null
  inputName?: string
  label: string
  onRemove: () => void
  onUpload: (file: File) => void
  /** Matches Additional filters chip; real file input behind the control */
  presentation?: 'chip' | 'default'
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
  presentation = 'default',
  showUploadIcon = false,
}: FileUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const compactFileName = fileName ? formatCompactFileName(fileName, compactMaxLength) : ''

  if (presentation === 'chip') {
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
            title={fileName}
            type="button"
          >
            <span className="upload-slot-chip-filename">{compactFileName}</span>
            <span className="upload-slot-chip-trailing-icon">
              <TrashGlyph />
            </span>
          </button>
        ) : (
          <button className="upload-slot-chip-btn" onClick={() => inputRef.current?.click()} type="button">
            {showUploadIcon ? (
              <>
                <span className="upload-slot-chip-label">{label}</span>
                <span className="upload-slot-chip-trailing-icon">
                  <UploadGlyph />
                </span>
              </>
            ) : (
              <span>{label}</span>
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

  return (
    <div className="upload-slot">
      <span className="upload-slot-label">{label}</span>
      {fileName ? (
        <div className="upload-slot-file">
          <span className="upload-slot-filename" title={fileName}>
            {compactFileName}
          </span>
          <div className="upload-slot-actions">
            <button className="button" onClick={() => inputRef.current?.click()} type="button">
              Replace
            </button>
            <button
              className="button button-ghost"
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.value = ''
                }
                onRemove()
              }}
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button className="upload-slot-empty" onClick={() => inputRef.current?.click()} type="button">
          Upload {label.toLowerCase()}
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
