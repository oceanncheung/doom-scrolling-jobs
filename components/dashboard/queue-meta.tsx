import { refreshDashboardQueue } from '@/app/dashboard/actions'
import { QueueRefreshButton } from '@/components/jobs/queue-refresh-button'
import type { QueueView } from '@/lib/jobs/dashboard-queue'

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
  const copy: Record<QueueView, { eyebrow: string; label: string; note: string }> = {
    applied: {
      eyebrow: 'Applied',
      label: `${totalCount} applied jobs`,
      note: 'Submitted roles and active follow-up states.',
    },
    archive: {
      eyebrow: 'Archive',
      label: `${totalCount} archived jobs`,
      note: 'Skipped, rejected, and archived roles live here.',
    },
    potential: {
      eyebrow: 'Potential jobs',
      label: `${potentialVisibleCount} of ${potentialTotalCount} screening jobs`,
      note:
        potentialTotalCount > potentialVisibleCount
          ? 'Save or skip to replenish from the next ranked jobs.'
          : 'Save or skip to keep the screening queue moving.',
    },
    prepared: {
      eyebrow: 'Prepared',
      label: `${totalCount} prepared jobs`,
      note: 'Applications that already have materials ready.',
    },
    saved: {
      eyebrow: 'Saved',
      label: `${totalCount} saved jobs`,
      note: 'Shortlisted roles waiting for review or prep.',
    },
  }

  return (
    <div className="queue-meta">
      <div
        className={
          activeView === 'potential'
            ? 'queue-meta-heading queue-meta-heading-with-action'
            : 'queue-meta-heading'
        }
      >
        <div>
          <p className="panel-label">{copy[activeView].eyebrow}</p>
          <h1>{copy[activeView].label}</h1>
        </div>
        {activeView === 'potential' ? (
          <form action={refreshDashboardQueue} className="queue-meta-actions">
            <input name="view" type="hidden" value={activeView} />
            <QueueRefreshButton />
          </form>
        ) : null}
      </div>
      <p>{copy[activeView].note}</p>
    </div>
  )
}
