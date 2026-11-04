import type { FlagVerificationFeedback } from '@/lib/sites/flag-resolution'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import { formatEvidenceTimestamp } from '@/lib/time/format'

export function FlagVerificationNotice({ feedback }: { feedback: FlagVerificationFeedback }) {
  const checkedAt = feedback.checkedAt && formatEvidenceTimestamp(feedback.checkedAt)
  return <p role="status" className="rounded-control bg-muted/30 p-4 text-sm">
    {feedback.result === 'still_open' || feedback.result === 'regressed' ? C.flagVerificationStillOpen : C.flagVerificationInconclusive}
    {checkedAt ? <> <time className="block pt-1 text-xs text-muted-foreground" dateTime={feedback.checkedAt!}>{checkedAt}</time></> : null}
  </p>
}
