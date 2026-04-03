'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { hasSupabaseServerEnv } from '@/lib/env'
import { ensurePrimaryImportedJobs } from '@/lib/jobs/real-feed'

function normalizeView(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim().toLowerCase()

  if (text === 'saved' || text === 'prepared' || text === 'applied' || text === 'archive') {
    return text
  }

  return 'potential'
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

  redirect(`/dashboard?view=${view}`)
}
