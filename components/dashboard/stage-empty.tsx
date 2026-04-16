export function StageEmpty({
  message,
  title,
}: {
  message: string
  title: string
}) {
  return (
    <article className="empty-state">
      <p className="panel-label">{title}</p>
      <p className="column-reading-copy">{message}</p>
    </article>
  )
}
