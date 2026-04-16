import { OperatorEntryClient } from '@/components/operators/operator-entry-client'
import { getOperatorSessionState } from '@/lib/data/operators'

export async function OperatorEntryScreen() {
  const session = await getOperatorSessionState()

  return <OperatorEntryClient issue={session.issue} operators={session.operators} />

}
