import type { WorkflowStatus } from '@/lib/domain/types'
import type { RankedJobRecord } from '@/lib/jobs/contracts'

interface LearningExample {
  job: RankedJobRecord
  weight: number
}

interface LearningContribution {
  contribution: number
  example: LearningExample
  similarity: number
}

const workflowSignalWeights: Partial<Record<WorkflowStatus, number>> = {
  applied: 2.5,
  archived: -2,
  follow_up_due: 2.1,
  interview: 2.8,
  preparing: 1.4,
  ready_to_apply: 1.8,
  shortlisted: 1.1,
}

const learningScale = 3.1
const maxLearningDelta = 8
const minReasonContribution = 0.6

function roundScore(value: number) {
  return Math.round(value * 10) / 10
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function toPhraseSet(values: string[]) {
  return new Set(
    values.map((value) => normalizeToken(value)).filter((value) => value.length > 0),
  )
}

function toTokenSet(values: string[]) {
  return new Set(
    values
      .flatMap((value) => normalizeToken(value).split(/\s+/))
      .filter((value) => value.length > 1),
  )
}

function getIntersection<T>(left: Set<T>, right: Set<T>) {
  return [...left].filter((value) => right.has(value))
}

function getOverlapRatio(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) {
    return 0
  }

  const shared = getIntersection(left, right).length
  const union = new Set([...left, ...right]).size

  return union === 0 ? 0 : shared / union
}

function getExactMatchRatio(left: string[], right: string[]) {
  return getOverlapRatio(toPhraseSet(left), toPhraseSet(right))
}

function getRoleSimilarity(candidate: RankedJobRecord, example: RankedJobRecord) {
  return getOverlapRatio(
    toTokenSet([candidate.title, candidate.department ?? '']),
    toTokenSet([example.title, example.department ?? '']),
  )
}

function getSenioritySimilarity(candidate: RankedJobRecord, example: RankedJobRecord) {
  return getOverlapRatio(
    toTokenSet([candidate.seniorityLabel ?? '']),
    toTokenSet([example.seniorityLabel ?? '']),
  )
}

function getRemoteSimilarity(candidate: RankedJobRecord, example: RankedJobRecord) {
  return getExactMatchRatio(candidate.remoteRegions, example.remoteRegions)
}

function getDepartmentSimilarity(candidate: RankedJobRecord, example: RankedJobRecord) {
  if (!candidate.department || !example.department) {
    return 0
  }

  return normalizeToken(candidate.department) === normalizeToken(example.department) ? 1 : 0
}

function getSkillSimilarity(candidate: RankedJobRecord, example: RankedJobRecord) {
  return getExactMatchRatio(candidate.skillsKeywords, example.skillsKeywords)
}

function computeSimilarity(candidate: RankedJobRecord, example: RankedJobRecord) {
  const skillSimilarity = getSkillSimilarity(candidate, example)
  const roleSimilarity = getRoleSimilarity(candidate, example)
  const departmentSimilarity = getDepartmentSimilarity(candidate, example)
  const senioritySimilarity = getSenioritySimilarity(candidate, example)
  const remoteSimilarity = getRemoteSimilarity(candidate, example)

  return (
    skillSimilarity * 0.45 +
    roleSimilarity * 0.25 +
    departmentSimilarity * 0.1 +
    senioritySimilarity * 0.1 +
    remoteSimilarity * 0.1
  )
}

function getSignalWeight(status: WorkflowStatus) {
  return workflowSignalWeights[status] ?? 0
}

function describeSharedTraits(candidate: RankedJobRecord, example: RankedJobRecord) {
  const sharedTraits: string[] = []
  const sharedSkills = getIntersection(
    toPhraseSet(candidate.skillsKeywords),
    toPhraseSet(example.skillsKeywords),
  )
  const sharedRoleTokens = getIntersection(
    toTokenSet([candidate.title, candidate.department ?? '']),
    toTokenSet([example.title, example.department ?? '']),
  )
  const sharedRegions = getIntersection(
    toPhraseSet(candidate.remoteRegions),
    toPhraseSet(example.remoteRegions),
  )

  if (sharedSkills.length > 0) {
    sharedTraits.push(sharedSkills.slice(0, 2).join(' and '))
  }

  if (sharedRoleTokens.length > 0) {
    sharedTraits.push(`${sharedRoleTokens.slice(0, 2).join(' / ')} role patterns`)
  }

  if (
    candidate.seniorityLabel &&
    example.seniorityLabel &&
    getSenioritySimilarity(candidate, example) > 0.4
  ) {
    sharedTraits.push(`${candidate.seniorityLabel.toLowerCase()} scope`)
  }

  if (sharedRegions.length > 0) {
    sharedTraits.push(`${sharedRegions.join(' and ')} remote coverage`)
  }

  return sharedTraits.slice(0, 2)
}

function buildFeedbackReasons(
  candidate: RankedJobRecord,
  positiveContributions: LearningContribution[],
  negativeContributions: LearningContribution[],
) {
  const reasons: string[] = []
  const strongestPositive = positiveContributions[0]
  const strongestNegative = negativeContributions[0]

  if (strongestPositive && strongestPositive.contribution >= minReasonContribution) {
    const traits = describeSharedTraits(candidate, strongestPositive.example.job)
    reasons.push(
      traits.length > 0
        ? `Past shortlist/apply behavior favors ${traits.join(' and ')}.`
        : `Past shortlist/apply behavior favors roles similar to ${strongestPositive.example.job.title}.`,
    )
  }

  if (strongestNegative && Math.abs(strongestNegative.contribution) >= minReasonContribution) {
    const traits = describeSharedTraits(candidate, strongestNegative.example.job)
    reasons.push(
      traits.length > 0
        ? `Past dismiss behavior pushes down ${traits.join(' and ')}.`
        : `Past dismiss behavior pushes down roles similar to ${strongestNegative.example.job.title}.`,
    )
  }

  return reasons
}

function buildFeedbackSummary(delta: number, reasons: string[]) {
  if (delta >= 2) {
    return 'Boosted by your past shortlist and apply behavior.'
  }

  if (delta <= -2) {
    return 'Pushed down by the kinds of roles you have dismissed before.'
  }

  if (reasons.length > 0) {
    return delta > 0
      ? 'Light positive personalization from your past workflow behavior.'
      : 'Light negative personalization from your past workflow behavior.'
  }

  return 'Not enough strong workflow signals yet to materially change this rank.'
}

export function applyWorkflowLearning(jobs: RankedJobRecord[]) {
  const examples: LearningExample[] = jobs
    .map((job) => ({
      job,
      weight: getSignalWeight(job.workflowStatus),
    }))
    .filter((example) => example.weight !== 0)

  if (examples.length === 0) {
    return jobs.map((job) => ({
      ...job,
      feedbackReasons: [],
      feedbackScoreDelta: 0,
      feedbackSummary: 'Not enough workflow feedback yet to personalize ranking.',
      personalizedScore: job.totalScore,
    }))
  }

  return jobs
    .map((job) => {
      const contributions = examples
        .filter((example) => example.job.id !== job.id)
        .map((example) => {
          const similarity = computeSimilarity(job, example.job)

          return {
            contribution: example.weight * similarity * learningScale,
            example,
            similarity,
          }
        })
        .filter((item) => Math.abs(item.contribution) >= 0.2)
        .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))

      const totalDelta = clamp(
        contributions.reduce((sum, item) => sum + item.contribution, 0),
        -maxLearningDelta,
        maxLearningDelta,
      )
      const positiveContributions = contributions.filter((item) => item.contribution > 0)
      const negativeContributions = contributions.filter((item) => item.contribution < 0)
      const feedbackReasons = buildFeedbackReasons(job, positiveContributions, negativeContributions)
      const feedbackScoreDelta = roundScore(totalDelta)

      return {
        ...job,
        feedbackReasons,
        feedbackScoreDelta,
        feedbackSummary: buildFeedbackSummary(feedbackScoreDelta, feedbackReasons),
        personalizedScore: roundScore(job.totalScore + feedbackScoreDelta),
      }
    })
    .sort((left, right) => {
      const leftScore = left.personalizedScore ?? left.totalScore
      const rightScore = right.personalizedScore ?? right.totalScore

      if (leftScore === rightScore) {
        return right.totalScore - left.totalScore
      }

      return rightScore - leftScore
    })
}
