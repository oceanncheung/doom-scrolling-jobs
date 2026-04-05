import { refreshDashboardQueue } from '@/app/dashboard/actions'
import { QueueRefreshButton } from '@/components/jobs/queue-refresh-button'
import type { QueueView } from '@/lib/jobs/dashboard-queue'
import { getQueueMetaViewModel } from '@/lib/jobs/dashboard-view-model'

export function QueueMeta({
  activeView,
  potentialVisibleCount,
  potentialTotalCount,
  totalCount,
}: {
  activeView: QueueView
  potentialVisibleCount: number
  potentialTotalCount: number
  totalCount: number
}) {
  const copy = getQueueMetaViewModel({
    activeView,
    potentialTotalCount,
    potentialVisibleCount,
    totalCount,
  })

  return (
    <div className="queue-meta">
      <div
        className={
          copy.showRefresh
            ? 'queue-meta-heading queue-meta-heading-with-action'
            : 'queue-meta-heading'
        }
      >
        <div>
          <p className="panel-label">{copy.eyebrow}</p>
          {copy.showRefresh ? (
            <div className="queue-meta-title-row">
              <h1>{copy.label}</h1>
              <form action={refreshDashboardQueue} className="queue-meta-actions">
                <input name="view" type="hidden" value={activeView} />
                <QueueRefreshButton />
              </form>
            </div>
          ) : (
            <h1>{copy.label}</h1>
          )}
        </div>
      </div>
      <p>{copy.note}</p>
    </div>
  )
}
