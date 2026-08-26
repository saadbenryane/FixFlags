import type { AgentMessage, AgentMessageKind, AgentMessageState } from '@/lib/audit/agent-message'
import { compareFlagsByPriority } from '@/lib/audit/priority-flags'
import { PIPELINE_PROGRESS, PIPELINE_PROGRESS_SUBSTEP } from '@/lib/audit/progress'
import type { ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { getUserFacingAuditError } from '@/lib/audit/user-facing-errors'
import { AGENT_SCAN_COPY } from '@/lib/marketing/copy'
import { reviewPathLabel, canonicalizeDestination } from '@/lib/audit/url-identity'

export type ScanAgentFlag = {
  id: string
  problem: string
  rubric: string
  severity?: string | null
  checkId?: string | null
  impactTag?: string | null
  pageUrl?: string | null
}

/** How many confirmed Flags the Agent names in the transcript. The rest stay in Report. */
export const ANNOUNCED_FLAG_LIMIT = 3

function flagPathLabel(pageUrl?: string | null, pastedUrl?: string | null): string | null {
  if (!pageUrl) return null
  const pageKey = canonicalizeDestination(pageUrl)?.key
  const pastedKey = pastedUrl ? canonicalizeDestination(pastedUrl)?.key : null
  if (pageKey && pastedKey && pageKey === pastedKey) return null
  return reviewPathLabel(pageUrl)
}

function asRankable(flag: ScanAgentFlag) {
  return {
    id: flag.id,
    rubric: flag.rubric,
    severity: flag.severity ?? '',
    problem: flag.problem,
    checkId: flag.checkId ?? null,
    impactTag: flag.impactTag ?? null,
  }
}

/**
 * Choose the Flags the Agent should name. Same comparator as Finish Plan
 * and the Report list, so the first thing said is the first thing shown.
 */
export function selectAnnouncedFlags(flags: ScanAgentFlag[]): ScanAgentFlag[] {
  return [...flags]
    .sort((a, b) => compareFlagsByPriority(asRankable(a), asRankable(b)))
    .slice(0, ANNOUNCED_FLAG_LIMIT)
}

export type FixFlagsScanSnapshot = {
  id: string
  status: string
  url?: string | null
  progress?: number | null
  startedAt?: Date | string | null
  completedAt?: Date | string | null
  reportCompleteness?: string | null
  failureCode?: string | null
  journeyReviewIncluded?: boolean | null
  journeyReviewAt?: Date | string | null
  screenshotCapture?: ScreenshotCaptureStatus | null
  flags?: ScanAgentFlag[] | null
}

type MessageInput = {
  suffix: string
  kind: AgentMessageKind
  state: AgentMessageState
  content: string
  createdAt?: Date | string | null
  flagId?: string
}

function iso(value?: Date | string | null): string | undefined {
  if (!value) return undefined
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

function message(snapshot: FixFlagsScanSnapshot, input: MessageInput): AgentMessage {
  return {
    id: `scan:${snapshot.id}:${input.suffix}`,
    sessionId: snapshot.id,
    auditId: snapshot.id,
    role: 'agent',
    source: 'scan',
    kind: input.kind,
    state: input.state,
    content: input.content,
    createdAt: iso(input.createdAt),
    flagId: input.flagId,
    evidenceRef: input.flagId
      ? { auditId: snapshot.id, flagId: input.flagId }
      : undefined,
  }
}

const STATUS_RANK: Record<string, number> = {
  QUEUED: 0,
  CAPTURING: 1,
  CHECKING: 2,
  JUDGING: 3,
  FINALIZING: 4,
  COMPLETED: 5,
}

function reached(snapshot: FixFlagsScanSnapshot, status: keyof typeof STATUS_RANK): boolean {
  const rank = STATUS_RANK[snapshot.status]
  if (typeof rank === 'number') return rank >= STATUS_RANK[status]

  const progress = snapshot.progress ?? 0
  const threshold = PIPELINE_PROGRESS[status as keyof typeof PIPELINE_PROGRESS]
  return typeof threshold === 'number' && progress >= threshold
}

/**
 * Pure, cumulative projection of persisted scan facts into the Agent transcript.
 * It intentionally knows nothing about timers, polling cadence, or Action Timeline events.
 */
export function buildFixFlagsScanMessages(snapshot: FixFlagsScanSnapshot): AgentMessage[] {
  const result: AgentMessage[] = []
  const checksReached =
    reached(snapshot, 'CHECKING') ||
    (snapshot.progress ?? 0) >= PIPELINE_PROGRESS_SUBSTEP.CHECKS_STARTED

  result.push(message(snapshot, {
    suffix: 'preparing',
    kind: 'progress',
    state: snapshot.status === 'QUEUED' || (snapshot.status === 'FAILED' && !reached(snapshot, 'CAPTURING'))
      ? 'active'
      : 'complete',
    content: AGENT_SCAN_COPY.preparing,
    createdAt: snapshot.startedAt,
  }))

  if (reached(snapshot, 'CAPTURING')) {
    result.push(message(snapshot, {
      suffix: 'capturing',
      kind: 'progress',
      state: snapshot.status === 'CAPTURING' || (snapshot.status === 'FAILED' && !checksReached)
        ? 'active'
        : 'complete',
      content: AGENT_SCAN_COPY.capturing,
    }))
  }

  const capture = snapshot.screenshotCapture
  const captureSettled =
    reached(snapshot, 'CHECKING') ||
    (snapshot.status === 'FAILED' && reached(snapshot, 'CAPTURING'))
  if (captureSettled && capture && (capture.desktop === 'failed' || capture.mobile === 'failed')) {
    const captureUnavailable = capture.desktop === 'failed' && capture.mobile === 'failed'
    result.push(message(snapshot, {
      suffix: captureUnavailable ? 'capture-unavailable' : 'capture-partial',
      kind: 'warning',
      state: 'warning',
      content: captureUnavailable ? AGENT_SCAN_COPY.captureUnavailable : AGENT_SCAN_COPY.capturePartial,
    }))
  }

  if (checksReached) {
    result.push(message(snapshot, {
      suffix: 'checking',
      kind: 'progress',
      state: snapshot.status === 'CHECKING' || snapshot.status === 'FAILED' ? 'active' : 'complete',
      content: AGENT_SCAN_COPY.checking,
    }))

    const flags = snapshot.flags ?? []
    for (const flag of selectAnnouncedFlags(flags)) {
      result.push(message(snapshot, {
        suffix: `flag:${flag.id}`,
        kind: 'flag',
        state: 'complete',
        content: AGENT_SCAN_COPY.confirmedFlag(
          flag.rubric,
          flag.problem,
          flagPathLabel(flag.pageUrl, snapshot.url)
        ),
        flagId: flag.id,
      }))
    }
    if (flags.length > 3) {
      result.push(message(snapshot, {
        suffix: 'additional-flags',
        kind: 'progress',
        state: 'complete',
        content: AGENT_SCAN_COPY.additionalFlags(flags.length - 3),
      }))
    }
  }

  const journeyReached =
    snapshot.journeyReviewIncluded === true &&
    ((snapshot.progress ?? 0) >= PIPELINE_PROGRESS_SUBSTEP.JOURNEY_START ||
      snapshot.journeyReviewAt != null ||
      reached(snapshot, 'JUDGING'))
  if (journeyReached) {
    const journeyComplete =
      snapshot.journeyReviewAt != null ||
      (snapshot.progress ?? 0) >= PIPELINE_PROGRESS_SUBSTEP.JOURNEY_DONE ||
      reached(snapshot, 'JUDGING')
    result.push(message(snapshot, {
      suffix: 'journey',
      kind: 'progress',
      state: journeyComplete ? 'complete' : 'active',
      content: AGENT_SCAN_COPY.journey,
      createdAt: snapshot.journeyReviewAt,
    }))
  }

  if (reached(snapshot, 'JUDGING')) {
    result.push(message(snapshot, {
      suffix: 'prioritizing',
      kind: 'progress',
      state: snapshot.status === 'JUDGING' ? 'active' : 'complete',
      content: AGENT_SCAN_COPY.prioritizing,
    }))
  }

  if (reached(snapshot, 'FINALIZING')) {
    result.push(message(snapshot, {
      suffix: 'finalizing',
      kind: 'progress',
      state: snapshot.status === 'FINALIZING' ? 'active' : 'complete',
      content: AGENT_SCAN_COPY.finalizing,
    }))
  }

  if (snapshot.status === 'COMPLETED') {
    if (snapshot.failureCode === 'AI_REVIEW_FAILED') {
      result.push(message(snapshot, {
        suffix: 'partial-ai',
        kind: 'warning',
        state: 'warning',
        content: AGENT_SCAN_COPY.partialAi,
      }))
    }
    result.push(message(snapshot, {
      suffix: 'complete',
      kind: 'completion',
      state: 'complete',
      content: snapshot.reportCompleteness === 'PARTIAL'
        ? AGENT_SCAN_COPY.partiallyReady
        : AGENT_SCAN_COPY.ready,
      createdAt: snapshot.completedAt,
    }))
  } else if (snapshot.status === 'FAILED') {
    result.push(message(snapshot, {
      suffix: 'failed',
      kind: 'failure',
      state: 'failed',
      content: getUserFacingAuditError(snapshot.failureCode),
    }))
  }

  return result
}
