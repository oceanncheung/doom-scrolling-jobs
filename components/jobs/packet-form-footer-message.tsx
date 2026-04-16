import { ActionFormMessage, type ActionFormStatus } from '@/components/jobs/action-form-primitives'

interface PacketFormFooterMessageProps {
  message: string
  status: ActionFormStatus
}

export function PacketFormFooterMessage({
  message,
  status,
}: PacketFormFooterMessageProps) {
  return (
    <div className="profile-form-footer packet-form-footer">
      <div className="packet-form-footer-inner">
        <ActionFormMessage message={message} status={status} tone="form-message" />
      </div>
    </div>
  )
}
