'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { hasSupabaseServerEnv } from '@/lib/env'
import { getQueueView, getQueueViewHref } from '@/lib/jobs/dashboard-queue'
import { ensurePrimaryImportedJobs } from '@/lib/jobs/real-feed'

function normalizeView(value: FormDataEntryValue | null) {
  return getQueueView(String(value ?? '').trim().toLowerCase())
}

export async function refreshDashboardQueue(formData: FormData) {
  const view = normalizeView(formData.get('view'))

  if (hasSupabaseServerEnv()) {
    await ensurePrimaryImportedJobs({
      force: true,
      markMissingAsStale: true,
    })
  }

  revalidatePath('/dashboard')
  revalidatePath('/jobs/[jobId]', 'page')

  redirect(getQueueViewHref(view))
}
