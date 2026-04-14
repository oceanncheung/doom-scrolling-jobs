import { DownloadIcon } from '@/components/ui/icons/download-icon'

interface PacketMaterialDownloadButtonProps {
  disabled?: boolean
  href?: string
  label: string
  title?: string
  variant?: 'primary' | 'ghost'
}

export function PacketMaterialDownloadButton({
  disabled = false,
  href,
  label,
  title,
  variant = 'primary',
}: PacketMaterialDownloadButtonProps) {
  const variantClass = variant === 'ghost' ? 'button-ghost' : 'button-primary'
  const className = `button ${variantClass} button-small packet-material-download-button`

  const content = (
    <span className="packet-material-download-button__content">
      <span className="packet-material-download-button__label">{label}</span>
      <span aria-hidden className="upload-slot-chip-trailing-icon">
        <DownloadIcon className="upload-slot-chip-icon-svg" />
      </span>
    </span>
  )

  if (disabled || !href) {
    return (
      <button className={className} disabled title={title} type="button">
        {content}
      </button>
    )
  }

  return (
    <a className={className} href={href} title={title}>
      {content}
    </a>
  )
}
