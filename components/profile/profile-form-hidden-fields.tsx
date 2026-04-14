interface ProfileFormHiddenFieldsProps {
  allowedRemoteRegionTags: string[]
  capabilityDisciplineTags: string[]
  capabilityToolsTags: string[]
  certificationTags: string[]
  hiringMarketTags: string[]
  industriesPreferredTags: string[]
  keyDifferentiatorTags: string[]
  languageTags: string[]
  matchingMarketStrictness: string
  matchingRoleBreadth: string
  matchingSourceMix: string
  outputConstraintTags: string[]
  selectionRuleTags: string[]
  skillsTags: string[]
  sourceCoverLetterFileName: string | null
  sourceResumeFileName: string | null
  targetRoleTags: string[]
  targetSeniorityLevels: string[]
  timezoneTags: string[]
  toneVoiceTags: string[]
  toolsTags: string[]
  adjacentRoleTags: string[]
}

export function ProfileFormHiddenFields({
  adjacentRoleTags,
  allowedRemoteRegionTags,
  capabilityDisciplineTags,
  capabilityToolsTags,
  certificationTags,
  hiringMarketTags,
  industriesPreferredTags,
  keyDifferentiatorTags,
  languageTags,
  matchingMarketStrictness,
  matchingRoleBreadth,
  matchingSourceMix,
  outputConstraintTags,
  selectionRuleTags,
  skillsTags,
  sourceCoverLetterFileName,
  sourceResumeFileName,
  targetRoleTags,
  targetSeniorityLevels,
  timezoneTags,
  toneVoiceTags,
  toolsTags,
}: ProfileFormHiddenFieldsProps) {
  return (
    <>
      <input name="hiringMarkets" type="hidden" value={hiringMarketTags.join('\n')} />
      <input name="targetSeniorityLevels" type="hidden" value={targetSeniorityLevels.join('\n')} />
      <input name="targetRoles" type="hidden" value={targetRoleTags.join('\n')} />
      <input name="allowedAdjacentRoles" type="hidden" value={adjacentRoleTags.join('\n')} />
      <input name="matchingRoleBreadth" type="hidden" value={matchingRoleBreadth} />
      <input name="matchingMarketStrictness" type="hidden" value={matchingMarketStrictness} />
      <input name="matchingSourceMix" type="hidden" value={matchingSourceMix} />
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
    </>
  )
}
