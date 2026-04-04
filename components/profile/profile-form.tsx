'use client'

import { useActionState, useState } from 'react'
import { createPortal } from 'react-dom'

import type {
  OperatorPortfolioItemRecord,
  OperatorWorkspaceRecord,
  ResumeAchievementRecord,
  ResumeEducationRecord,
  ResumeExperienceRecord,
} from '@/lib/domain/types'

import { saveOperatorProfile, type ProfileActionState } from '@/app/profile/actions'
import { useProfileSaveMessageRoot } from '@/components/profile/profile-save-message-root'
import { AdvancedFiltersSection } from '@/components/profile/sections/advanced-filters-section'
import { ApplicationMaterialsSection } from '@/components/profile/sections/application-materials-section'
import {
  ExperienceStrengthsSection,
  type StrengthsTab,
} from '@/components/profile/sections/experience-strengths-section'
import { JobTargetsSection } from '@/components/profile/sections/job-targets-section'
import {
  normalizeSalaryFloorCurrency,
} from '@/lib/profile/salary-currency'
import {
  seniorityLevelToSelectValue,
} from '@/lib/profile/seniority-level'

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

function createAchievementEntry(): ResumeAchievementRecord {
  return {
    category: '',
    title: '',
    detail: '',
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

function targetSenioritySelectDefaults(seniorityLevel: string) {
  const raw = seniorityLevel.trim()
  const mapped = seniorityLevelToSelectValue(seniorityLevel)
  if (raw.length > 0 && mapped === '') {
    return { defaultValue: raw, legacyOption: raw }
  }
  return { defaultValue: mapped, legacyOption: null }
}

export function ProfileForm({ workspace }: ProfileFormProps) {
  const [state, formAction] = useActionState(saveOperatorProfile, initialState)
  const saveMessageRoot = useProfileSaveMessageRoot()
  const [activeStrengthsTab, setActiveStrengthsTab] = useState<StrengthsTab | null>(null)
  const [targetRoleTags, setTargetRoleTags] = useState(() => [...workspace.profile.targetRoles])
  const [adjacentRoleTags, setAdjacentRoleTags] = useState(() => [
    ...workspace.profile.allowedAdjacentRoles,
  ])
  const [coverLetterPdfName, setCoverLetterPdfName] = useState<string | null>(
    workspace.resumeMaster.coverLetterPdfFileName || null,
  )
  const [portfolioPdfName, setPortfolioPdfName] = useState<string | null>(
    workspace.resumeMaster.portfolioPdfFileName || null,
  )
  const [resumePdfName, setResumePdfName] = useState<string | null>(
    workspace.resumeMaster.resumePdfFileName || null,
  )
  const [experienceEntries, setExperienceEntries] = useState(
    workspace.resumeMaster.experienceEntries.length > 0
      ? workspace.resumeMaster.experienceEntries
      : [createExperienceEntry()],
  )
  const [achievementBank, setAchievementBank] = useState(
    workspace.resumeMaster.achievementBank.length > 0
      ? workspace.resumeMaster.achievementBank
      : [createAchievementEntry()],
  )
  const [educationEntries, setEducationEntries] = useState(
    workspace.resumeMaster.educationEntries.length > 0
      ? workspace.resumeMaster.educationEntries
      : [createEducationEntry()],
  )
  const [portfolioItems, setPortfolioItems] = useState(workspace.portfolioItems)
  const [skillsTags, setSkillsTags] = useState(() => [...workspace.profile.skills])
  const [toolsTags, setToolsTags] = useState(() => [...workspace.profile.tools])
  const [certificationTags, setCertificationTags] = useState(() => [
    ...workspace.resumeMaster.certifications,
  ])
  const senioritySelect = targetSenioritySelectDefaults(workspace.profile.seniorityLevel)
  const [timezoneTags, setTimezoneTags] = useState(() =>
    tagsFromDelimitedString(workspace.profile.timezone),
  )
  const [allowedRemoteRegionTags, setAllowedRemoteRegionTags] = useState(() => [
    ...workspace.profile.allowedRemoteRegions,
  ])
  const [industriesPreferredTags, setIndustriesPreferredTags] = useState(() => [
    ...workspace.profile.industriesPreferred,
  ])

  return (
    <form action={formAction} className="profile-form settings-main" id="profile-workspace-form">
      <input name="targetRoles" type="hidden" value={targetRoleTags.join('\n')} />
      <input name="allowedAdjacentRoles" type="hidden" value={adjacentRoleTags.join('\n')} />
      <input name="skills" type="hidden" value={skillsTags.join('\n')} />
      <input name="tools" type="hidden" value={toolsTags.join('\n')} />
      <input name="certifications" type="hidden" value={certificationTags.join('\n')} />
      <input name="resumeSkillsSection" type="hidden" value={skillsTags.join('\n')} />
      <input name="resumePdfFileName" type="hidden" value={resumePdfName ?? ''} />
      <input name="coverLetterPdfFileName" type="hidden" value={coverLetterPdfName ?? ''} />
      <input name="portfolioPdfFileName" type="hidden" value={portfolioPdfName ?? ''} />
      <input name="timezone" type="hidden" value={timezoneTags.join(', ')} />
      <input name="allowedRemoteRegions" type="hidden" value={allowedRemoteRegionTags.join('\n')} />
      <input name="industriesPreferred" type="hidden" value={industriesPreferredTags.join('\n')} />

      <ApplicationMaterialsSection
        coverLetterPdfName={coverLetterPdfName}
        portfolioPdfName={portfolioPdfName}
        resumePdfName={resumePdfName}
        resumeSummaryText={workspace.resumeMaster.summaryText}
        setCoverLetterPdfName={setCoverLetterPdfName}
        setPortfolioPdfName={setPortfolioPdfName}
        setResumePdfName={setResumePdfName}
      />

      <JobTargetsSection
        adjacentRoleTags={adjacentRoleTags}
        primaryMarket={workspace.profile.primaryMarket}
        relocationOpen={workspace.profile.relocationOpen}
        remoteRequired={workspace.profile.remoteRequired}
        salaryFloorCurrency={normalizeSalaryFloorCurrency(workspace.profile.salaryFloorCurrency)}
        salaryTargetMax={workspace.profile.salaryTargetMax}
        salaryTargetMin={workspace.profile.salaryTargetMin}
        searchBrief={workspace.profile.searchBrief}
        senioritySelect={senioritySelect}
        setAdjacentRoleTags={setAdjacentRoleTags}
        setTargetRoleTags={setTargetRoleTags}
        targetRoleTags={targetRoleTags}
      />

      <ExperienceStrengthsSection
        achievementBank={achievementBank}
        activeStrengthsTab={activeStrengthsTab}
        bioSummary={workspace.profile.bioSummary}
        certificationTags={certificationTags}
        createAchievementEntry={createAchievementEntry}
        createEducationEntry={createEducationEntry}
        createExperienceEntry={createExperienceEntry}
        createPortfolioItem={createPortfolioItem}
        educationEntries={educationEntries}
        experienceEntries={experienceEntries}
        portfolioItems={portfolioItems}
        setAchievementBank={setAchievementBank}
        setActiveStrengthsTab={setActiveStrengthsTab}
        setCertificationTags={setCertificationTags}
        setEducationEntries={setEducationEntries}
        setExperienceEntries={setExperienceEntries}
        setPortfolioItems={setPortfolioItems}
        setSkillsTags={setSkillsTags}
        setToolsTags={setToolsTags}
        skillsTags={skillsTags}
        toolsTags={toolsTags}
      />

      <AdvancedFiltersSection
        allowedRemoteRegionTags={allowedRemoteRegionTags}
        industriesPreferredTags={industriesPreferredTags}
        setAllowedRemoteRegionTags={setAllowedRemoteRegionTags}
        setIndustriesPreferredTags={setIndustriesPreferredTags}
        setTimezoneTags={setTimezoneTags}
        timezoneTags={timezoneTags}
      />

      {saveMessageRoot
        ? createPortal(
            <div className="profile-rail-save-message">
        <div
          className={`form-message ${
            state.status === 'success'
              ? 'form-message-success'
              : state.status === 'error'
                ? 'form-message-error'
                : ''
          }`}
        >
          {state.message ||
                  'Saved changes update job recommendations, packet drafts, and portfolio picks.'}
        </div>
            </div>,
            saveMessageRoot,
          )
        : null}
    </form>
  )
}
