'use client'

import { useFormStatus } from 'react-dom'

function QueueRefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.15"
      viewBox="0 0 24 24"
      width="24"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

export function QueueRefreshButton() {
  const { pending } = useFormStatus()

  return (
    <button
      aria-label={pending ? 'Refreshing jobs' : 'Refresh jobs'}
      className="queue-refresh-mark"
      disabled={pending}
      title={pending ? 'Refreshing jobs' : 'Refresh jobs'}
      type="submit"
    >
      <QueueRefreshIcon className="queue-refresh-icon" />
    </button>
  )
}
