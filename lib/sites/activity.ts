import { SITE_ACTIVITY_COPY } from '@/lib/marketing/copy/terminology'

export type SiteActivity = {
  state: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'unverified'
  label: string
  pagesReached: number
  milestones: Array<{ label: string; state: 'done' | 'current' | 'pending' | 'partial' }>
  events: Array<{ label: string; at: string }>
}

const stages = ['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING', 'COMPLETED']
const labels = SITE_ACTIVITY_COPY.stages
/** Stage anchors are not percentages. Navigation is proven only by persisted page evidence. */
export function projectSiteActivity(input: {
  status: string | null
  startedAt: Date | null
  failureCode: string | null
  pages: Array<{ status: string }>
  events: Array<{ stage: string; event?: string; status: string; occurredAt: Date }>
}): SiteActivity {
  const index = stages.indexOf(input.status ?? '')
  const pagesReached = input.pages.filter((page) => ['CHECKING', 'JUDGING', 'COMPLETED', 'PARTIAL'].includes(page.status)).length
  const failed = input.status === 'FAILED'
  const state = !input.status ? 'unverified' : failed ? 'failed' : input.status === 'COMPLETED'
    ? input.failureCode ? 'partial' : 'completed' : input.status === 'QUEUED' ? 'queued' : 'running'
  return {
    state,
    label: failed ? input.startedAt ? 'This check did not finish' : 'This check did not start'
      : state === 'unverified' ? 'No check yet' : state === 'partial' ? 'Some checks could not finish' : labels[index] ?? 'Checking website',
    pagesReached,
    milestones: [
      { label: 'Website reached', state: pagesReached > 0 ? 'done' : input.status === 'CAPTURING' ? 'current' : 'pending' },
      ...labels.slice(1, 5).map((label, offset) => ({
        label,
        state: offset === 2 && input.failureCode && /^(AI_|AUDIT_TIMEOUT|AUDIT_PIPELINE_FAILED)/.test(input.failureCode) && ['FAILED', 'COMPLETED'].includes(input.status ?? '')
          ? 'partial' as const
          : (offset === 3 && input.status === 'COMPLETED') || input.events.some((event) => (!input.startedAt || event.occurredAt >= input.startedAt)
          && event.status === 'completed'
          && (offset === 2 ? event.event === 'triage_completed' : event.stage.toUpperCase() === stages[offset + 1] && /^(capture_completed|checks_completed|persist_completed|completed)$/.test(event.event ?? '')))
          ? 'done' as const : !failed && index === offset + 1 ? 'current' as const : 'pending' as const,
      })),
    ],
    // One latest receipt per milestone, not a per-page event dump. Old attempt
    // receipts cannot describe the current execution after restart recovery.
    events: stages.flatMap((stage, stageIndex) => {
      const receipts = input.events.filter((event) => event.stage.toUpperCase() === stage
        && (!input.startedAt || event.occurredAt >= input.startedAt)
        && ['completed', 'started', 'failed', 'skipped', 'partial'].includes(event.status.toLowerCase()))
      const receipt = receipts.at(-1)
      return receipt ? [{ label: receipt.status === 'completed' ? SITE_ACTIVITY_COPY.recorded[stageIndex]
        : receipt.status === 'failed' ? SITE_ACTIVITY_COPY.interrupted[stageIndex]
        : receipt.status === 'skipped' ? `${labels[stageIndex]}: skipped`
        : receipt.status === 'partial' ? `${labels[stageIndex]}: incomplete` : labels[stageIndex], at: receipt.occurredAt.toISOString() }] : []
    }).sort((a, b) => a.at.localeCompare(b.at)),
  }
}
