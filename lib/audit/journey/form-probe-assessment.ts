import { runNetworkEngagementChecks } from '../checks/network-engagement'
import { whyItMattersForCheckId } from '../flag-copy'
import type { JourneyFindingDraft, JourneyRunResult } from './types'

type Input = { probe: NonNullable<JourneyRunResult['formProbe']>; stepNumber: number; pageUrl: string; existingCheckIds: ReadonlySet<string> }
type Assessment = { findings: JourneyFindingDraft[]; events: Array<{ kind: 'network' | 'form'; label: string; url: string; status: number }> }
function finding(partial: Omit<JourneyFindingDraft, 'confidence'>): JourneyFindingDraft { return { confidence: 0.85, ...partial } }

export function assessFormProbeResponse(input: Input): Assessment {
  const { probe } = input
  const findings: JourneyFindingDraft[] = []
  const events: Assessment['events'] = []
  const classified = runNetworkEngagementChecks([], probe)
  if (probe.status >= 400 && classified.length === 0) events.push({ kind: 'network',
    label: `Form probe ${probe.status} (not classified as authorization or server failure)`, url: probe.url, status: probe.status })
  for (const flag of classified) {
    if (input.existingCheckIds.has(flag.checkId)) continue
    events.push({ kind: 'network', label: `Form probe ${probe.status}`, url: probe.url, status: probe.status })
    findings.push(finding({ checkId: flag.checkId, stepNumber: input.stepNumber, url: input.pageUrl,
      rubric: 'EXPERIENCE', severity: flag.severity as JourneyFindingDraft['severity'], impactTag: 'CONVERSION',
      problem: flag.problem, evidence: `Reproduced at step ${input.stepNumber}. ${flag.evidence}`,
      whyItMatters: whyItMattersForCheckId(flag.checkId), fix: flag.fix }))
  }

  return { findings, events }
}

export function assessFormProbeConfirmation(input: Input & { showsSuccess: boolean }): Assessment {
  const { probe } = input
  const findings: JourneyFindingDraft[] = []
  const events: Assessment['events'] = []
  if (probe && probe.status > 0 && !input.existingCheckIds.has('form-submit-silent-failure')) {
    const okStatus = probe.status >= 200 && probe.status < 300
    if (okStatus && !input.showsSuccess) {
      events.push({ kind: 'form', label: 'Silent form failure (2xx, no success UI)', url: probe.url, status: probe.status })
      findings.push(
        finding({
          checkId: 'form-submit-silent-failure',
          stepNumber: input.stepNumber,
          url: input.pageUrl,
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          impactTag: 'CONVERSION',
          problem:
            'Form submit succeeds without a clear success state (or shows success after a failed API)',
          evidence: `Reproduced at step ${input.stepNumber}. ${probe.method} ${probe.status} ${probe.url} · API returned success but no thank-you or confirmation copy appeared`,
          whyItMatters: whyItMattersForCheckId('form-submit-silent-failure'),
          fix: '1. After a successful submit, show a thank-you or confirmation state.\n2. Never show success copy when the API failed.\n3. Re-check the form after deploying.',
        })
      )
    } else if (!okStatus && input.showsSuccess) {
      events.push({ kind: 'form', label: 'Misleading success UI after failed API', url: probe.url, status: probe.status })
      findings.push(
        finding({
          checkId: 'form-submit-silent-failure',
          stepNumber: input.stepNumber,
          url: input.pageUrl,
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          impactTag: 'CONVERSION',
          problem:
            'Form submit succeeds without a clear success state (or shows success after a failed API)',
          evidence: `Reproduced at step ${input.stepNumber}. ${probe.method} ${probe.status} ${probe.url} · Page showed success copy after a failed API response`,
          whyItMatters: whyItMattersForCheckId('form-submit-silent-failure'),
          fix: '1. After a successful submit, show a thank-you or confirmation state.\n2. Never show success copy when the API failed.\n3. Re-check the form after deploying.',
        })
      )
    }
  }

  return { findings, events }
}
