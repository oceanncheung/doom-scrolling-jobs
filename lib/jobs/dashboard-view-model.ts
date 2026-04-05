import type { QueueView } from '@/lib/jobs/dashboard-queue'

export interface QueueMetaViewModel {
  eyebrow: string
  label: string
  note: string
  showRefresh: boolean
}

export interface QueueEmptyStateViewModel {
  message: string
  title: string
}

export function getQueueMetaViewModel({
  activeView,
  potentialTotalCount,
  potentialVisibleCount,
  totalCount,
}: {
  activeView: QueueView
  potentialTotalCount: number
  potentialVisibleCount: number
  totalCount: number
}): QueueMetaViewModel {
  const copy: Record<QueueView, Omit<QueueMetaViewModel, 'showRefresh'>> = {
    applied: {
      eyebrow: 'Applied',
      label: `${totalCount} applied jobs`,
      note: 'Submitted roles and active follow-up states.',
    },
    archive: {
      eyebrow: 'Archived',
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
      eyebrow: 'Ready',
      label: `${totalCount} ready jobs`,
      note: 'Saved roles with application materials ready to submit.',
    },
    saved: {
      eyebrow: 'Saved',
      label: `${totalCount} saved jobs`,
      note: 'Saved roles waiting for review or packet work.',
    },
  }

  return {
    ...copy[activeView],
    showRefresh: activeView === 'potential',
  }
}

export function getQueueEmptyState(activeView: QueueView, screeningLocked: boolean): QueueEmptyStateViewModel {
  switch (activeView) {
    case 'applied':
      return {
        message: 'Applied jobs will collect here once you mark them sent.',
        title: 'Applied',
      }
    case 'archive':
      return {
        message: 'Skipped and archived jobs will show up here.',
        title: 'Archived',
      }
    case 'potential':
      return {
        message: screeningLocked
          ? 'Complete your profile draft in Settings to unlock Potential.'
          : 'No active screening jobs are available right now.',
        title: 'Potential',
      }
    case 'prepared':
      return {
        message: 'Mark a packet ready and it will show up here.',
        title: 'Ready',
      }
    case 'saved':
      return {
        message: 'Saved jobs will appear here after you shortlist them.',
        title: 'Saved',
      }
  }
}
