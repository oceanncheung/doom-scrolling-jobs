'use client'

import { useActionState, useRef, useState } from 'react'

import type { OperatorWorkspaceRecord } from '@/lib/domain/types'

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
  const [, formAction] = useActionState(saveOperatorProfile, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const { applicationTitleTags, setApplicationTitleTags } = useProfileApplicationTitles()
  const { requestSaveButtonFlash } = useProfileSaveButtonAttention()
  const { setReviewIndicatorsVisible } = useProfileReviewIndicators()
  const initialFormState = createProfileFormInitialState(workspace)
  const [activeStrengthsTab, setActiveStrengthsTab] = useState<StrengthsTab | null>(null)
  const [activeCoverLetterTab, setActiveCoverLetterTab] = useState<CoverLetterStrategyTab | null>(null)
  const [bioSummary, setBioSummary] = useState(initialFormState.bioSummary)
  const [searchBrief, setSearchBrief] = useState(initialFormState.searchBrief)
  const [hiringMarketTags, setHiringMarketTags] = useState(initialFormState.hiringMarketTags)
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
    sourceCoverLetterFileName,
    workspace,
  })

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
