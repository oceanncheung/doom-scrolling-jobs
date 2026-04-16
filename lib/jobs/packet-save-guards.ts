import type { PacketGenerationStatus } from '@/lib/domain/types'
import type { PacketSubmitIntent } from '@/lib/jobs/packet-lifecycle'

export const missingPacketSaveGuardMessage = 'Generate content first before marking this application ready.'
export const generatedContentRequiredGuardMessage =
  'Generate the resume, cover letter, and answers before marking this application ready.'

function asTextValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function inferPacketGenerationStatus(record: Record<string, unknown> | null): PacketGenerationStatus {
  if (!record) {
    return 'not_started'
  }

  const explicitStatus = asTextValue(record.generation_status)

  if (
    explicitStatus === 'not_started' ||
    explicitStatus === 'running' ||
    explicitStatus === 'generated' ||
    explicitStatus === 'failed'
  ) {
    return explicitStatus
  }

  if (
    asTextValue(record.generated_at) ||
    asTextValue(record.cover_letter_draft) ||
    asTextValue(record.professional_summary)
  ) {
    return 'generated'
  }

  return 'not_started'
}

export function getPacketSaveGuardMessage({
  existingPacket,
  submitIntent,
}: {
  existingPacket: Record<string, unknown> | null
  submitIntent: PacketSubmitIntent
}) {
  if (!existingPacket) {
    return missingPacketSaveGuardMessage
  }

  if (submitIntent === 'mark-ready' && inferPacketGenerationStatus(existingPacket) !== 'generated') {
    return generatedContentRequiredGuardMessage
  }

  return null
}
