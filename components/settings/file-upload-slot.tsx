'use client'

import { useRef } from 'react'

function UploadGlyph() {
  return (
    <svg aria-hidden className="upload-slot-chip-icon-svg" fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path
        d="M7 9.5V3.5M4.5 5.5 7 3l2.5 2.5M2.5 11h9"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.2"
      />
    </svg>
  )
}

interface FileUploadSlotProps {
  accept?: string
  fileName?: string | null
  label: string
  onRemove: () => void
  onUpload: (file: File) => void
  /** Matches Additional filters chip; real file input behind the control */
  presentation?: 'chip' | 'default'
}

export function FileUploadSlot({
  accept = '.pdf',
  fileName,
  label,
  onRemove,
  onUpload,
  presentation = 'default',
}: FileUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  if (presentation === 'chip') {
    return (
      <div className="upload-slot upload-slot--chip">
        {fileName ? (
          <div className="upload-slot-chip-filled">
            <span className="upload-slot-chip-filename" title={fileName}>
              {fileName}
            </span>
            <div className="upload-slot-chip-file-actions">
              <button
                aria-label={`Replace ${label}`}
                className="upload-slot-chip-icon-btn"
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                <UploadGlyph />
              </button>
              <button className="button button-ghost button-small" onClick={onRemove} type="button">
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button className="upload-slot-chip-btn" onClick={() => inputRef.current?.click()} type="button">
            <span>{label}</span>
            <span aria-hidden="true" className="upload-slot-chip-icon">
              <UploadGlyph />
            </span>
          </button>
        )}
        <input
          accept={accept}
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              onUpload(f)
            }
            e.target.value = ''
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
          <span className="upload-slot-filename">{fileName}</span>
          <div className="upload-slot-actions">
            <button className="button" onClick={() => inputRef.current?.click()} type="button">
              Replace
            </button>
            <button className="button button-ghost" onClick={onRemove} type="button">
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
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            onUpload(f)
          }
          e.target.value = ''
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  )
}
