import {
  PacketInlineNote,
  PacketRemediationCallout,
} from '@/components/jobs/packet-primitives'
import { SectionHeading } from '@/components/ui/section-heading'
import type { ApplicationPacketRecord } from '@/lib/domain/types'
import { buildPacketPreGenerationViewModel } from '@/lib/jobs/packet-view-model'
import type { ProfileReadinessPresentation } from '@/lib/profile/readiness-presentation'

interface PacketPreGenerationSectionProps {
  packet: Pick<ApplicationPacketRecord, 'answers' | 'generationError' | 'generationStatus' | 'packetStatus' | 'questionSnapshotStatus'>
  /** When false, incomplete-ATS failures should not use the profile remediation callout (user has Settings material + resume source). */
  profileMaterialReady: boolean
  readinessPresentation?: ProfileReadinessPresentation | null
  screeningLocked?: boolean
}

export function PacketPreGenerationSection({
  packet,
  profileMaterialReady,
  readinessPresentation,
  screeningLocked = false,
}: PacketPreGenerationSectionProps) {
  const viewModel = buildPacketPreGenerationViewModel({
    packet,
    profileMaterialReady,
    readinessPresentation,
    screeningLocked,
  })

  return (
    <section className="packet-section">
      <div className="packet-section-inner">
        <SectionHeading
          className="packet-section-heading"
          label={viewModel.label}
          note={viewModel.note}
          title={viewModel.title}
        />

        {viewModel.mode === 'locked' || viewModel.mode === 'profile-remediation' ? (
          <PacketRemediationCallout
            actionHref={viewModel.actionHref}
            actionLabel={viewModel.actionLabel}
            hint={viewModel.lines[1]}
            lead={viewModel.lines[0]}
          />
        ) : (
          <PacketInlineNote>
            {viewModel.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </PacketInlineNote>
        )}
      </div>
    </section>
  )
}
