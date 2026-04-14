interface DownloadIconProps {
  className?: string
  height?: number
  width?: number
}

/** Stroke icon aligned with `UploadIcon` (14×14, square caps); arrow points down toward a baseline. */
export function DownloadIcon({ className, height = 14, width = 14 }: DownloadIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={height}
      viewBox="0 0 14 14"
      width={width}
    >
      <path
        d="M7 3.5v7M4.5 8 7 10.5 9.5 8M3 11.5h8"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="1.2"
      />
    </svg>
  )
}
