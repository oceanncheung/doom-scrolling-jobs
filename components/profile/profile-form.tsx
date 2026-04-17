'use client'

import { useActionState, useEffect, useMemo, useRef, useState } from 'react'

import type {
  MatchingMarketStrictness,
  MatchingRoleBreadth,
  MatchingSourceMix,
  OperatorWorkspaceRecord,
} from '@/lib/domain/types'

import { saveOperatorProfile, type ProfileActionState } from '@/app/profile/actions'
import { ProfileFormHiddenFields } from '@/components/profile/profile-form-hidden-fields'
import {
  createCoverLetterProofBankEntry,
  createEducationEntry,
  createExperienceEntry,
  createPortfolioItem,
  createProfileFormInitialState,
  getProfileFormDraftState,
} from '@/components/profile/profile-form-state'
import { useProfileNavigationGuard } from '@/components/profile/use-profile-navigation-guard'
import {
  useProfileApplicationTitles,
  useProfileReviewIndicators,
  useProfileSaveButtonAttention,
} from '@/components/profile/profile-save-message-root'
import { AdvancedFiltersSection } from '@/components/profile/sections/advanced-filters-section'
import { ApplicationMaterialsSection } from '@/components/profile/sections/application-materials-section'
import {
  CoverLetterStrategySection,
  type CoverLetterStrategyTab,
} from '@/components/profile/sections/cover-letter-strategy-section'
import {
  ExperienceStrengthsSection,
  type StrengthsTab,
} from '@/components/profile/sections/experience-strengths-section'
import { JobTargetsSection } from '@/components/profile/sections/job-targets-section'
import {
  combineReviewStates,
  getReviewStateFromList,
  getReviewStateFromPresence,
  getReviewStateFromText,
  getSectionConfidence,
} from '@/lib/profile/master-assets'
import { normalizeSalaryFloorCurrency } from '@/lib/profile/salary-currency'

const initialState: ProfileActionState = {
  message: '',
  status: 'idle',
}

interface ProfileFormProps {
  workspace: OperatorWorkspaceRecord
}

export function ProfileForm({ workspace }: ProfileFormProps) {
  const [actionState, formAction] = useActionState(saveOperatorProfile, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const lastSubmitIntentRef = useRef<string | null>(null)
  const dirtyCheckFrameRef = useRef<number | null>(null)
  const lastHandledSuccessKeyRef = useRef<string | null>(null)
  const baselineFormSnapshotRef = useRef<Map<string, string> | null>(null)
  const { applicationTitleTags, setApplicationTitleTags } = useProfileApplicationTitles()
  const { requestSaveButtonFlash, setHasUnsavedChanges } = useProfileSaveButtonAttention()
  const { setReviewIndicatorsVisible } = useProfileReviewIndicators()
  const initialFormState = createProfileFormInitialState(workspace)
  const initialDraftState = getProfileFormDraftState({
    sourceResumeFileName: initialFormState.sourceResumeFileName,
    sourceCoverLetterFileName: initialFormState.sourceCoverLetterFileName,
    workspace,
  })
  const [activeStrengthsTab, setActiveStrengthsTab] = useState<StrengthsTab | null>(null)
  const [activeCoverLetterTab, setActiveCoverLetterTab] = useState<CoverLetterStrategyTab | null>(null)
  const [bioSummary, setBioSummary] = useState(initialFormState.bioSummary)
  const [searchBrief, setSearchBrief] = useState(initialFormState.searchBrief)
  const [hiringMarketTags, setHiringMarketTags] = useState(initialFormState.hiringMarketTags)
  const [matchingPreferences, setMatchingPreferences] = useState(initialFormState.matchingPreferences)
  const [targetSeniorityLevels, setTargetSeniorityLevels] = useState(
    initialFormState.targetSeniorityLevels,
  )
  const [adjacentRoleTags, setAdjacentRoleTags] = useState(initialFormState.adjacentRoleTags)
  const [sourceCoverLetterFileName, setSourceCoverLetterFileName] = useState<string | null>(
    initialFormState.sourceCoverLetterFileName,
  )
  const [sourceResumeFileName, setSourceResumeFileName] = useState<string | null>(
    initialFormState.sourceResumeFileName,
  )
  const [generatedSourceSnapshot, setGeneratedSourceSnapshot] = useState(() => ({
    coverLetterFileName: initialDraftState.isGeneratedFromCurrentSources
      ? initialFormState.sourceCoverLetterFileName
      : null,
    resumeFileName: initialDraftState.isGeneratedFromCurrentSources
      ? initialFormState.sourceResumeFileName
      : null,
  }))
  const [hasSourceChangesSinceGeneration, setHasSourceChangesSinceGeneration] = useState(false)
  const [experienceEntries, setExperienceEntries] = useState(initialFormState.experienceEntries)
  const [educationEntries, setEducationEntries] = useState(initialFormState.educationEntries)
  const [portfolioItems, setPortfolioItems] = useState(initialFormState.portfolioItems)
  const [skillsTags, setSkillsTags] = useState(initialFormState.skillsTags)
  const [toolsTags, setToolsTags] = useState(initialFormState.toolsTags)
  const [languageTags, setLanguageTags] = useState(initialFormState.languageTags)
  const [certificationTags, setCertificationTags] = useState(initialFormState.certificationTags)
  const [positioningPhilosophy, setPositioningPhilosophy] = useState(
    initialFormState.positioningPhilosophy,
  )
  const [capabilityDisciplineTags, setCapabilityDisciplineTags] = useState(
    initialFormState.capabilityDisciplineTags,
  )
  const [capabilityToolsTags, setCapabilityToolsTags] = useState(
    initialFormState.capabilityToolsTags,
  )
  const [proofBankEntries, setProofBankEntries] = useState(initialFormState.proofBankEntries)
  const [toneVoiceTags, setToneVoiceTags] = useState(initialFormState.toneVoiceTags)
  const [keyDifferentiatorTags, setKeyDifferentiatorTags] = useState(
    initialFormState.keyDifferentiatorTags,
  )
  const selectionRuleTags = workspace.coverLetterMaster.selectionRules
  const outputConstraintTags = workspace.coverLetterMaster.outputConstraints
  const [timezoneTags, setTimezoneTags] = useState(initialFormState.timezoneTags)
  const [allowedRemoteRegionTags, setAllowedRemoteRegionTags] = useState(
    initialFormState.allowedRemoteRegionTags,
  )
  const [industriesPreferredTags, setIndustriesPreferredTags] = useState(
    initialFormState.industriesPreferredTags,
  )
  const { hasGeneratedDraft, hasCoverLetterSource } = getProfileFormDraftState({
    sourceResumeFileName,
    sourceCoverLetterFileName,
    workspace,
  })
  const isProfileGeneratedCurrent =
    hasGeneratedDraft &&
    !hasSourceChangesSinceGeneration &&
    generatedSourceSnapshot.resumeFileName === sourceResumeFileName &&
    generatedSourceSnapshot.coverLetterFileName === sourceCoverLetterFileName

  const serializeCurrentForm = useMemo(
    () => () => {
      const form = formRef.current

      if (!form) {
        return null
      }

      const snapshot = new FormData(form)
      const fields = new Map<string, string>()

      for (const [key, value] of snapshot.entries()) {
        if (value instanceof File) {
          continue
        }

        // Multiple inputs can share a name (e.g. tag hidden inputs). Join values so the
        // combined string captures every instance while still being diffable per-name.
        const stringValue = String(value)
        const existing = fields.get(key)
        fields.set(key, existing === undefined ? stringValue : `${existing}\n${stringValue}`)
      }

      return fields
    },
    [],
  )

  const syncDirtyState = useMemo(
    () => () => {
      const current = serializeCurrentForm()

      if (!current) {
        return
      }

      if (baselineFormSnapshotRef.current === null) {
        baselineFormSnapshotRef.current = current
        return
      }

      const baseline = baselineFormSnapshotRef.current

      /*
       * Auto-extend the baseline with any field that appears in the current form but not in the
       * baseline. Tab/disclosure toggles reveal additional inputs (with their initial values) —
       * those are UI state changes, not data changes. Adopting them as the new baseline means
       * opening/closing a tab doesn't flip the save button on/off; only an actual value edit does.
       */
      for (const [key, value] of current) {
        if (!baseline.has(key)) {
          baseline.set(key, value)
        }
      }

      let hasDifference = false
      for (const [key, value] of current) {
        if (baseline.get(key) !== value) {
          hasDifference = true
          break
        }
      }

      setHasUnsavedChanges(hasDifference)
    },
    [serializeCurrentForm, setHasUnsavedChanges],
  )

  const scheduleDirtyCheck = useMemo(
    () => () => {
      if (dirtyCheckFrameRef.current !== null) {
        window.cancelAnimationFrame(dirtyCheckFrameRef.current)
      }

      dirtyCheckFrameRef.current = window.requestAnimationFrame(() => {
        dirtyCheckFrameRef.current = null
        syncDirtyState()
      })
    },
    [syncDirtyState],
  )

  const summaryReviewState = getReviewStateFromText(
    bioSummary,
    getSectionConfidence(workspace.resumeMaster.sectionProvenance, 'professionalSummary'),
  )
  const historyReviewState = getReviewStateFromPresence(
    experienceEntries.length > 0,
    getSectionConfidence(workspace.resumeMaster.sectionProvenance, 'professionalExperience'),
  )
  const educationReviewState = getReviewStateFromPresence(
    educationEntries.length > 0,
    getSectionConfidence(workspace.resumeMaster.sectionProvenance, 'education'),
  )
  const skillsToolsReviewState = combineReviewStates([
    getReviewStateFromList(
      skillsTags,
      getSectionConfidence(workspace.resumeMaster.sectionProvenance, 'coreExpertise'),
    ),
    getReviewStateFromList(
      toolsTags,
      getSectionConfidence(workspace.resumeMaster.sectionProvenance, 'toolsPlatforms'),
    ),
    getReviewStateFromList(
      languageTags,
      getSectionConfidence(workspace.resumeMaster.sectionProvenance, 'languages'),
    ),
  ])
  const certificationsReviewState = getReviewStateFromList(
    certificationTags,
    getSectionConfidence(workspace.resumeMaster.sectionProvenance, 'certifications'),
  )
  const searchBriefReviewState = getReviewStateFromText(searchBrief)
  const targetRolesReviewState = getReviewStateFromList(applicationTitleTags)
  const adjacentRolesReviewState = getReviewStateFromList(adjacentRoleTags)
  const seniorityReviewState = getReviewStateFromList(targetSeniorityLevels)
  const positioningReviewState = combineReviewStates([
    getReviewStateFromText(
      positioningPhilosophy,
      getSectionConfidence(workspace.coverLetterMaster.sectionProvenance, 'positioningPhilosophy'),
    ),
    getReviewStateFromList(
      capabilityDisciplineTags,
      getSectionConfidence(workspace.coverLetterMaster.sectionProvenance, 'capabilities'),
    ),
    getReviewStateFromList(
      capabilityToolsTags,
      getSectionConfidence(workspace.coverLetterMaster.sectionProvenance, 'capabilities'),
    ),
  ])
  const proofBankReviewState = getReviewStateFromPresence(
    proofBankEntries.length > 0,
    getSectionConfidence(workspace.coverLetterMaster.sectionProvenance, 'proofBank'),
  )
  const voiceReviewState = combineReviewStates([
    getReviewStateFromList(
      toneVoiceTags,
      getSectionConfidence(workspace.coverLetterMaster.sectionProvenance, 'toneVoice'),
    ),
    getReviewStateFromList(
      keyDifferentiatorTags,
      getSectionConfidence(workspace.coverLetterMaster.sectionProvenance, 'keyDifferentiators'),
    ),
  ])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const snapshot = serializeCurrentForm()

      if (!snapshot) {
        return
      }

      baselineFormSnapshotRef.current = snapshot
      setHasUnsavedChanges(false)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [serializeCurrentForm, setHasUnsavedChanges])

  useEffect(() => {
    const handlePotentialFormChange = (event: Event) => {
      const form = formRef.current
      const target = event.target

      if (!form || !(target instanceof Element)) {
        return
      }

      const linkedControl = target.closest(`[form="${form.id}"]`)

      if (!form.contains(target) && !linkedControl) {
        return
      }

      scheduleDirtyCheck()
    }

    document.addEventListener('input', handlePotentialFormChange, true)
    document.addEventListener('change', handlePotentialFormChange, true)
    document.addEventListener('click', handlePotentialFormChange, true)

    return () => {
      document.removeEventListener('input', handlePotentialFormChange, true)
      document.removeEventListener('change', handlePotentialFormChange, true)
      document.removeEventListener('click', handlePotentialFormChange, true)
    }
  }, [scheduleDirtyCheck])

  useEffect(() => {
    if (actionState.status !== 'success' || lastSubmitIntentRef.current !== 'generate-profile') {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      setGeneratedSourceSnapshot({
        coverLetterFileName: sourceCoverLetterFileName,
        resumeFileName: sourceResumeFileName,
      })
      setHasSourceChangesSinceGeneration(false)
      lastSubmitIntentRef.current = null
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [actionState.message, actionState.status, sourceCoverLetterFileName, sourceResumeFileName])

  useEffect(() => {
    if (actionState.status !== 'success') {
      return
    }

    const successKey = `${actionState.status}:${actionState.message}`

    if (lastHandledSuccessKeyRef.current === successKey) {
      return
    }

    lastHandledSuccessKeyRef.current = successKey

    const frame = window.requestAnimationFrame(() => {
      baselineFormSnapshotRef.current = serializeCurrentForm()
      setHasUnsavedChanges(false)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [actionState.message, actionState.status, serializeCurrentForm, setHasUnsavedChanges])

  useEffect(
    () => () => {
      if (dirtyCheckFrameRef.current !== null) {
        window.cancelAnimationFrame(dirtyCheckFrameRef.current)
      }
    },
    [],
  )
  useProfileNavigationGuard({
    hasGeneratedDraft,
    historyReviewState,
    requestSaveButtonFlash,
    searchBriefReviewState,
    setReviewIndicatorsVisible,
    skillsToolsReviewState,
    summaryReviewState,
    targetRolesReviewState,
  })

  return (
    <form
      action={formAction}
      className="profile-form settings-main"
      encType="multipart/form-data"
      id="profile-workspace-form"
      onSubmitCapture={(event) => {
        const nativeEvent = event.nativeEvent
        const submitter =
          nativeEvent instanceof SubmitEvent ? nativeEvent.submitter : null
        const isGenerateIntent =
          submitter instanceof HTMLButtonElement &&
          submitter.name === 'intent' &&
          submitter.value === 'generate-profile'
        lastSubmitIntentRef.current =
          submitter instanceof HTMLButtonElement && submitter.value
            ? submitter.value
            : null

        setReviewIndicatorsVisible(!isGenerateIntent)
      }}
      ref={formRef}
    >
      <ProfileFormHiddenFields
        adjacentRoleTags={adjacentRoleTags}
        allowedRemoteRegionTags={allowedRemoteRegionTags}
        capabilityDisciplineTags={capabilityDisciplineTags}
        capabilityToolsTags={capabilityToolsTags}
        certificationTags={certificationTags}
        hiringMarketTags={hiringMarketTags}
        industriesPreferredTags={industriesPreferredTags}
        keyDifferentiatorTags={keyDifferentiatorTags}
        languageTags={languageTags}
        matchingMarketStrictness={matchingPreferences.marketStrictness}
        matchingRoleBreadth={matchingPreferences.roleBreadth}
        matchingSourceMix={matchingPreferences.sourceMix}
        outputConstraintTags={outputConstraintTags}
        selectionRuleTags={selectionRuleTags}
        skillsTags={skillsTags}
        sourceCoverLetterFileName={sourceCoverLetterFileName}
        sourceResumeFileName={sourceResumeFileName}
        targetRoleTags={applicationTitleTags}
        targetSeniorityLevels={targetSeniorityLevels}
        timezoneTags={timezoneTags}
        toneVoiceTags={toneVoiceTags}
        toolsTags={toolsTags}
      />

      <ApplicationMaterialsSection
        isProfileGeneratedCurrent={isProfileGeneratedCurrent}
        standalone={!hasGeneratedDraft}
        setSourceCoverLetterFileName={(value) => {
          setSourceCoverLetterFileName(value)
          setHasSourceChangesSinceGeneration(true)
          setHasUnsavedChanges(true)
        }}
        setSourceResumeFileName={(value) => {
          setSourceResumeFileName(value)
          setHasSourceChangesSinceGeneration(true)
          setHasUnsavedChanges(true)
        }}
        sourceCoverLetterFileName={sourceCoverLetterFileName}
        sourceResumeFileName={sourceResumeFileName}
      />

      {hasGeneratedDraft ? (
        <>
          <JobTargetsSection
            adjacentRoleTags={adjacentRoleTags}
            adjacentRolesReviewState={adjacentRolesReviewState}
            hiringMarketTags={hiringMarketTags}
            matchingMarketStrictness={matchingPreferences.marketStrictness}
            matchingRoleBreadth={matchingPreferences.roleBreadth}
            matchingSourceMix={matchingPreferences.sourceMix}
            relocationOpen={workspace.profile.relocationOpen}
            remoteRequired={workspace.profile.remoteRequired}
            salaryFloorCurrency={normalizeSalaryFloorCurrency(workspace.profile.salaryFloorCurrency)}
            salaryTargetMax={workspace.profile.salaryTargetMax}
            salaryTargetMin={workspace.profile.salaryTargetMin}
            searchBrief={searchBrief}
            searchBriefReviewState={searchBriefReviewState}
            setHiringMarketTags={setHiringMarketTags}
            setMatchingMarketStrictness={(value) =>
              setMatchingPreferences((current) => ({
                ...current,
                marketStrictness: value as MatchingMarketStrictness,
              }))
            }
            setMatchingRoleBreadth={(value) =>
              setMatchingPreferences((current) => ({
                ...current,
                roleBreadth: value as MatchingRoleBreadth,
              }))
            }
            setMatchingSourceMix={(value) =>
              setMatchingPreferences((current) => ({
                ...current,
                sourceMix: value as MatchingSourceMix,
              }))
            }
            setAdjacentRoleTags={setAdjacentRoleTags}
            setSearchBrief={setSearchBrief}
            setTargetSeniorityLevels={setTargetSeniorityLevels}
            setTargetRoleTags={setApplicationTitleTags}
            seniorityReviewState={seniorityReviewState}
            targetSeniorityLevels={targetSeniorityLevels}
            targetRoleTags={applicationTitleTags}
            targetRolesReviewState={targetRolesReviewState}
          />

          <ExperienceStrengthsSection
            activeStrengthsTab={activeStrengthsTab}
            bioSummary={bioSummary}
            certificationsReviewState={certificationsReviewState}
            certificationTags={certificationTags}
            createEducationEntry={createEducationEntry}
            createExperienceEntry={createExperienceEntry}
            createPortfolioItem={createPortfolioItem}
            educationEntries={educationEntries}
            educationReviewState={educationReviewState}
            experienceEntries={experienceEntries}
            historyReviewState={historyReviewState}
            languageTags={languageTags}
            portfolioItems={portfolioItems}
            setActiveStrengthsTab={setActiveStrengthsTab}
            setBioSummary={setBioSummary}
            setCertificationTags={setCertificationTags}
            setEducationEntries={setEducationEntries}
            setExperienceEntries={setExperienceEntries}
            setLanguageTags={setLanguageTags}
            setPortfolioItems={setPortfolioItems}
            setSkillsTags={setSkillsTags}
            setToolsTags={setToolsTags}
            skillsTags={skillsTags}
            skillsToolsReviewState={skillsToolsReviewState}
            summaryReviewState={summaryReviewState}
            toolsTags={toolsTags}
          />

          {hasCoverLetterSource ? (
            <CoverLetterStrategySection
              activeTab={activeCoverLetterTab}
              capabilityDisciplineTags={capabilityDisciplineTags}
              capabilityToolsTags={capabilityToolsTags}
              confirmedEvidenceEntries={workspace.confirmedEvidenceEntries}
              createProofBankEntry={createCoverLetterProofBankEntry}
              keyDifferentiatorTags={keyDifferentiatorTags}
              pendingEvidenceEntries={workspace.pendingEvidenceEntries}
              positioningPhilosophy={positioningPhilosophy}
              positioningReviewState={positioningReviewState}
              proofBankEntries={proofBankEntries}
              proofBankReviewState={proofBankReviewState}
              setActiveTab={setActiveCoverLetterTab}
              setCapabilityDisciplineTags={setCapabilityDisciplineTags}
              setCapabilityToolsTags={setCapabilityToolsTags}
              setKeyDifferentiatorTags={setKeyDifferentiatorTags}
              setPositioningPhilosophy={setPositioningPhilosophy}
              setProofBankEntries={setProofBankEntries}
              setToneVoiceTags={setToneVoiceTags}
              toneVoiceTags={toneVoiceTags}
              voiceReviewState={voiceReviewState}
            />
          ) : null}

          <AdvancedFiltersSection
            allowedRemoteRegionTags={allowedRemoteRegionTags}
            industriesPreferredTags={industriesPreferredTags}
            setAllowedRemoteRegionTags={setAllowedRemoteRegionTags}
            setIndustriesPreferredTags={setIndustriesPreferredTags}
            setTimezoneTags={setTimezoneTags}
            timezoneTags={timezoneTags}
          />
        </>
      ) : null}
    </form>
  )
}
