import { LabeledHeading } from '@/components/ui/labeled-heading'

interface PageIntroHeaderProps {
  className?: string
  label: string
  note: string
  title: string
}

export function PageIntroHeader({ className, label, note, title }: PageIntroHeaderProps) {
  return (
    <section className={['queue-meta', className].filter(Boolean).join(' ')}>
      <LabeledHeading className="queue-meta-heading" label={label} title={title} titleLevel="h1" />
      <p>{note}</p>
    </section>
  )
}
