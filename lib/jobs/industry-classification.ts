import 'server-only'

import {
  classifyJobIndustry,
  type JobIndustryClassification,
} from '@/lib/ai/tasks/classify-job-industry'
import { createClient } from '@/lib/supabase/server'

/**
 * Classify + persist industry tags for a single job row. Idempotent: callers pass
 * `skipIfClassified` to avoid re-running on jobs that already have a classification.
 *
 * Returns the classification (for logging), or null if the job had insufficient JD text.
 */

export interface ClassifyAndStoreOptions {
  skipIfClassified?: boolean
}

export interface ClassifyAndStoreResult {
  jobId: string
  action: 'classified' | 'skipped-already-classified' | 'skipped-thin-description' | 'failed'
  classification?: JobIndustryClassification
  errorMessage?: string
}

interface JobRowForClassification {
  id: string
  title: string | null
  company_name: string | null
  description_text: string | null
  description_text_fetched: string | null
  industry_classified_at: string | null
}

export async function classifyAndStoreJobIndustry(
  jobId: string,
  options: ClassifyAndStoreOptions = {},
): Promise<ClassifyAndStoreResult> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, company_name, description_text, description_text_fetched, industry_classified_at')
    .eq('id', jobId)
    .maybeSingle<JobRowForClassification>()

  if (error || !data) {
    return {
      jobId,
      action: 'failed',
      errorMessage: error?.message ?? 'Job row not found.',
    }
  }

  if (options.skipIfClassified !== false && data.industry_classified_at) {
    return {
      jobId,
      action: 'skipped-already-classified',
    }
  }

  let classification: JobIndustryClassification | null
  try {
    classification = await classifyJobIndustry({
      title: data.title ?? '',
      companyName: data.company_name ?? '',
      descriptionText: data.description_text ?? '',
      descriptionTextFetched: data.description_text_fetched ?? undefined,
    })
  } catch (err) {
    return {
      jobId,
      action: 'failed',
      errorMessage: err instanceof Error ? err.message : String(err),
    }
  }

  if (!classification) {
    return {
      jobId,
      action: 'skipped-thin-description',
    }
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      primary_industry: classification.primaryIndustry,
      adjacent_industries: classification.adjacentIndustries,
      industry_evidence: classification.industryEvidence,
      industry_classified_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  if (updateError) {
    return {
      jobId,
      action: 'failed',
      errorMessage: updateError.message,
    }
  }

  return {
    jobId,
    action: 'classified',
    classification,
  }
}
