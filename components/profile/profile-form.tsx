'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import type {
  CoverLetterProofBankEntryRecord,
  OperatorPortfolioItemRecord,
  OperatorWorkspaceRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
} from '@/lib/domain/types'

import { saveOperatorProfile, type ProfileActionState } from '@/app/profile/actions'
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
import { getTargetSeniorityLevels } from '@/lib/profile/seniority-level'

const initialState: ProfileActionState = {
  message: '',
  status: 'idle',
}

interface ProfileFormProps {
  workspace: OperatorWorkspaceRecord
}

function tagsFromDelimitedString(value: string) {
  return value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
}

function normalizeFileName(value: string | null | undefined) {
  if (!value) {
    return null
  }

  return value.trim() || null
}

function isAttentionState(state: string) {
  return state !== 'ready'
}

function getSourceContentString(sourceContent: Record<string, unknown>, key: string) {
  const value = sourceContent[key]
  return typeof value === 'string' ? value.trim() : ''
}

function createUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replaceAll(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    const value = character === 'x' ? random : (random & 0x3) | 0x8

    return value.toString(16)
  })
}

function createExperienceEntry(): ResumeExperienceRecord {
  return {
    companyName: '',
    roleTitle: '',
    locationLabel: '',
    startDate: '',
    endDate: '',
    summary: '',
    highlights: [],
  }
}

function createEducationEntry(): ResumeEducationRecord {
  return {
    schoolName: '',
    credential: '',
    fieldOfStudy: '',
    startDate: '',
    endDate: '',
    notes: '',
  }
}

function createPortfolioItem(): OperatorPortfolioItemRecord {
  return {
    id: createUuid(),
    title: '',
    url: '',
    projectType: '',
    roleLabel: '',
    summary: '',
    skillsTags: [],
    industryTags: [],
    outcomeMetrics: [],
    visualStrengthRating: '',
    isPrimary: false,
    isActive: true,
  }
}

function createCoverLetterProofBankEntry(): CoverLetterProofBankEntryRecord {
  return {
    bullets: [],
    context: '',
    label: '',
  }
}

export function ProfileForm({ workspace }: ProfileFormProps) {
  const [, formAction] = useActionState(saveOperatorProfile, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const { applicationTitleTags, setApplicationTitleTags } = useProfileApplicationTitles()
  const { requestSaveButtonFlash } = useProfileSaveButtonAttention()
  const { setReviewIndicatorsVisible } = useProfileReviewIndicators()
  const [activeStrengthsTab, setActiveStrengthsTab] = useState<StrengthsTab | null>(null)
  const [activeCoverLetterTab, setActiveCoverLetterTab] = useState<CoverLetterStrategyTab | null>(null)
  const [bioSummary, setBioSummary] = useState(workspace.profile.bioSummary)
  const [searchBrief, setSearchBrief] = useState(workspace.profile.searchBrief)
  const [hiringMarketTags, setHiringMarketTags] = useState(() =>
    [workspace.profile.primaryMarket, ...workspace.profile.secondaryMarkets].filter(
      (value, index, values) => value.trim().length > 0 && values.indexOf(value) === index,
    ),
  )
  const [targetSeniorityLevels, setTargetSeniorityLevels] = useState(() =>
    getTargetSeniorityLevels(
      workspace.profile.targetSeniorityLevels,
      workspace.profile.seniorityLevel,
    ),
  )
  const [adjacentRoleTags, setAdjacentRoleTags] = useState(() => [
    ...workspace.profile.allowedAdjacentRoles,
  ])
  const [sourceCoverLetterFileName, setSourceCoverLetterFileName] = useState<string | null>(
    normalizeFileName(workspace.resumeMaster.coverLetterPdfFileName),
  )
  const [sourceResumeFileName, setSourceResumeFileName] = useState<string | null>(
    normalizeFileName(workspace.resumeMaster.resumePdfFileName),
  )
  const [experienceEntries, setExperienceEntries] = useState(
    workspace.resumeMaster.experienceEntries.length > 0
      ? workspace.resumeMaster.experienceEntries
      : [createExperienceEntry()],
  )
  const [educationEntries, setEducationEntries] = useState(
    workspace.resumeMaster.educationEntries.length > 0
      ? workspace.resumeMaster.educationEntries
      : [createEducationEntry()],
  )
  const [portfolioItems, setPortfolioItems] = useState(workspace.portfolioItems)
  const [skillsTags, setSkillsTags] = useState(() => [...workspace.profile.skills])
  const [toolsTags, setToolsTags] = useState(() => [...workspace.profile.tools])
  const [languageTags, setLanguageTags] = useState(() => [...workspace.profile.languages])
  const [certificationTags, setCertificationTags] = useState(() => [
    ...workspace.resumeMaster.certifications,
  ])
  const [positioningPhilosophy, setPositioningPhilosophy] = useState(
    workspace.coverLetterMaster.positioningPhilosophy,
  )
  const [capabilityDisciplineTags, setCapabilityDisciplineTags] = useState(() => [
    ...workspace.coverLetterMaster.capabilities.disciplines,
  ])
  const [capabilityToolsTags, setCapabilityToolsTags] = useState(() => [
    ...workspace.coverLetterMaster.capabilities.productionTools,
  ])
  const [proofBankEntries, setProofBankEntries] = useState(
    workspace.coverLetterMaster.proofBank.length > 0
      ? workspace.coverLetterMaster.proofBank
      : [createCoverLetterProofBankEntry()],
  )
  const [toneVoiceTags, setToneVoiceTags] = useState(() => [...workspace.coverLetterMaster.toneVoice])
  const [keyDifferentiatorTags, setKeyDifferentiatorTags] = useState(() => [
    ...workspace.coverLetterMaster.keyDifferentiators,
  ])
  const selectionRuleTags = workspace.coverLetterMaster.selectionRules
  const outputConstraintTags = workspace.coverLetterMaster.outputConstraints
  const [timezoneTags, setTimezoneTags] = useState(() =>
    tagsFromDelimitedString(workspace.profile.timezone),
  )
  const [allowedRemoteRegionTags, setAllowedRemoteRegionTags] = useState(() => [
    ...workspace.profile.allowedRemoteRegions,
  ])
  const [industriesPreferredTags, setIndustriesPreferredTags] = useState(() => [
    ...workspace.profile.industriesPreferred,
  ])

  const resumeSourceContent = workspace.resumeMaster.sourceContent
  const coverLetterSourceContent = workspace.coverLetterMaster.sourceContent
  const resumeGeneratedFrom = getSourceContentString(resumeSourceContent, 'generatedFrom')
  const resumeDraftGeneratedAt = getSourceContentString(resumeSourceContent, 'rawResumeGeneratedAt')
  const persistedCoverLetterSourceText =
    getSourceContentString(resumeSourceContent, 'coverLetterSourceText') ||
    getSourceContentString(coverLetterSourceContent, 'coverLetterSourceText')
  const persistedCoverLetterSourceFileName =
    getSourceContentString(resumeSourceContent, 'coverLetterSourceFileName') ||
    getSourceContentString(coverLetterSourceContent, 'coverLetterSourceFileName')
  const hasGeneratedDraft = Boolean(
    workspace.status.sourceState === 'draft_generated' ||
      resumeGeneratedFrom === 'raw-source-upload' ||
      resumeDraftGeneratedAt,
  )
  const hasCoverLetterSource = Boolean(
    sourceCoverLetterFileName ||
      persistedCoverLetterSourceText ||
      persistedCoverLetterSourceFileName,
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
    function hasBlockingAttention() {
      if (!hasGeneratedDraft) {
        return false
      }

      const headlineInput = document.querySelector<HTMLInputElement>(
        'input[form="profile-workspace-form"][name="headline"]',
      )
      const locationInput = document.querySelector<HTMLInputElement | HTMLSelectElement>(
        'input[form="profile-workspace-form"][name="locationLabel"], select[form="profile-workspace-form"][name="locationLabel"]',
      )
      const headlineReviewState = getReviewStateFromText(headlineInput?.value ?? '')
      const locationReviewState = getReviewStateFromText(
        locationInput?.value ?? '',
      )

      return [
        headlineReviewState,
        locationReviewState,
        searchBriefReviewState,
        targetRolesReviewState,
        skillsToolsReviewState,
        summaryReviewState,
        historyReviewState,
      ].some(isAttentionState)
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      const link = target.closest('a[href]')
      if (!(link instanceof HTMLAnchorElement)) {
        return
      }

      if (link.target === '_blank' || link.hasAttribute('download')) {
        return
      }

      const href = link.getAttribute('href')
      if (!href || href.startsWith('#')) {
        return
      }

      const destination = new URL(link.href, window.location.href)
      const current = new URL(window.location.href)

      if (
        destination.origin !== current.origin ||
        (destination.pathname === current.pathname &&
          destination.search === current.search &&
          destination.hash === current.hash) ||
        !hasBlockingAttention()
      ) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      setReviewIndicatorsVisible(true)
      requestSaveButtonFlash()
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasBlockingAttention()) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('click', handleDocumentClick, true)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('click', handleDocumentClick, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [
    hasGeneratedDraft,
    historyReviewState,
    requestSaveButtonFlash,
    searchBriefReviewState,
    setReviewIndicatorsVisible,
    skillsToolsReviewState,
    summaryReviewState,
    targetRolesReviewState,
  ])

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

        setReviewIndicatorsVisible(!isGenerateIntent)
      }}
      ref={formRef}
    >
      <input name="hiringMarkets" type="hidden" value={hiringMarketTags.join('\n')} />
      <input name="targetSeniorityLevels" type="hidden" value={targetSeniorityLevels.join('\n')} />
      <input name="targetRoles" type="hidden" value={applicationTitleTags.join('\n')} />
      <input name="allowedAdjacentRoles" type="hidden" value={adjacentRoleTags.join('\n')} />
      <input name="skills" type="hidden" value={skillsTags.join('\n')} />
      <input name="tools" type="hidden" value={toolsTags.join('\n')} />
      <input name="languages" type="hidden" value={languageTags.join('\n')} />
      <input name="certifications" type="hidden" value={certificationTags.join('\n')} />
      <input name="resumeSkillsSection" type="hidden" value={skillsTags.join('\n')} />
      <input name="sourceResumeFileName" type="hidden" value={sourceResumeFileName ?? ''} />
      <input name="sourceCoverLetterFileName" type="hidden" value={sourceCoverLetterFileName ?? ''} />
      <input name="timezone" type="hidden" value={timezoneTags.join(', ')} />
      <input name="allowedRemoteRegions" type="hidden" value={allowedRemoteRegionTags.join('\n')} />
      <input name="industriesPreferred" type="hidden" value={industriesPreferredTags.join('\n')} />
      <input
        name="coverLetterCapabilityDisciplines"
        type="hidden"
        value={capabilityDisciplineTags.join('\n')}
      />
      <input name="coverLetterCapabilityTools" type="hidden" value={capabilityToolsTags.join('\n')} />
      <input name="coverLetterToneVoice" type="hidden" value={toneVoiceTags.join('\n')} />
      <input
        name="coverLetterKeyDifferentiators"
        type="hidden"
        value={keyDifferentiatorTags.join('\n')}
      />
      <input name="coverLetterSelectionRules" type="hidden" value={selectionRuleTags.join('\n')} />
      <input
        name="coverLetterOutputConstraints"
        type="hidden"
        value={outputConstraintTags.join('\n')}
      />

      <ApplicationMaterialsSection
        standalone={!hasGeneratedDraft}
        setSourceCoverLetterFileName={setSourceCoverLetterFileName}
        setSourceResumeFileName={setSourceResumeFileName}
        sourceCoverLetterFileName={sourceCoverLetterFileName}
        sourceResumeFileName={sourceResumeFileName}
      />

      {hasGeneratedDraft ? (
        <>
          <JobTargetsSection
            adjacentRoleTags={adjacentRoleTags}
            adjacentRolesReviewState={adjacentRolesReviewState}
            hiringMarketTags={hiringMarketTags}
            relocationOpen={workspace.profile.relocationOpen}
            remoteRequired={workspace.profile.remoteRequired}
            salaryFloorCurrency={normalizeSalaryFloorCurrency(workspace.profile.salaryFloorCurrency)}
            salaryTargetMax={workspace.profile.salaryTargetMax}
            salaryTargetMin={workspace.profile.salaryTargetMin}
            searchBrief={searchBrief}
            searchBriefReviewState={searchBriefReviewState}
            setHiringMarketTags={setHiringMarketTags}
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
              createProofBankEntry={createCoverLetterProofBankEntry}
              keyDifferentiatorTags={keyDifferentiatorTags}
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
