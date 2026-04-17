interface PencilIconProps {
  className?: string
  height?: number
  width?: number
}

export function PencilIcon({ className, height = 24, width = 24 }: PencilIconProps) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      height={height}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.15"
      viewBox="0 0 24 24"
      width={width}
    >
      <path d="M17 3l4 4L7 21H3v-4L17 3z" />
      <path d="M14 6l4 4" />
    </svg>
  )
}
