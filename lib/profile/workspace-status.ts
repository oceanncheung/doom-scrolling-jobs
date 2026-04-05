import type {
  CoverLetterMasterRecord,
  OperatorProfileRecord,
  ProfileWorkspaceStatusRecord,
  ResumeMasterRecord,
} from '@/lib/domain/types'
import { buildProfileWorkspaceStatus } from '@/lib/profile/master-assets'

export function deriveProfileWorkspaceStatus(options: {
  coverLetterMaster: CoverLetterMasterRecord
  profile: Pick<
    OperatorProfileRecord,
    'canonicalProfileReviewedAt' | 'headline' | 'locationLabel' | 'searchBrief' | 'skills' | 'targetRoles'
  >
  resumeMaster: ResumeMasterRecord
}): ProfileWorkspaceStatusRecord {
  return buildProfileWorkspaceStatus(options)
}
