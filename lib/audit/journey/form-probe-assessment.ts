import type { JourneyFindingDraft, JourneyRunResult } from './types'

type Input = { probe: NonNullable<JourneyRunResult['formProbe']>; stepNumber: number; pageUrl: string; existingCheckIds: ReadonlySet<string> }
type Assessment = { findings: JourneyFindingDraft[]; events: Array<{ kind: 'network' | 'form'; label: string; url: string; status: number }> }
function finding(partial: Omit<JourneyFindingDraft, 'confidence'>): JourneyFindingDraft { return { confidence: 0.85, ...partial } }

export function assessFormProbeResponse(input: Input): Assessment {
  const { probe } = input
  const findings: JourneyFindingDraft[] = []
  const events: Assessment['events'] = []
  if (probe && probe.status >= 400) {
    const statusCode = probe.status
    const checkId =
      statusCode === 401 || statusCode === 403
        ? 'form-submit-api-unauthorized'
        : statusCode >= 500
          ? 'form-submit-api-server-error'
          : 'form-submit-api-unauthorized'
    if (!input.existingCheckIds.has(checkId)) {
      events.push({ kind: 'network', label: `Form probe ${statusCode}`, url: probe.url, status: probe.status })
      findings.push(
        finding({
          checkId,
          stepNumber: input.stepNumber,
          url: input.pageUrl,
          rubric: 'EXPERIENCE',
          severity: 'CRITICAL',
          impactTag: 'CONVERSION',
          problem:
            statusCode === 401 || statusCode === 403
              ? 'Form submission API returned unauthorized'
              : 'Form submission API returned an error',
          evidence: `Reproduced at step ${input.stepNumber}. ${probe.method} ${probe.status} ${probe.url}`,
          whyItMatters:
            'Users who complete the form cannot finish signup, newsletter, or contact.',
          fix: '1. Fix auth or server errors on the engagement submit endpoint.\n2. Show a clear error to the user.\n3. Re-check the form after deploying.',
        })
      )
    }
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
          whyItMatters: 'Users think nothing happened after submit and abandon or resubmit.',
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
          whyItMatters: 'Users trust a fake confirmation while the submission never completed.',
          fix: '1. After a successful submit, show a thank-you or confirmation state.\n2. Never show success copy when the API failed.\n3. Re-check the form after deploying.',
        })
      )
    }
  }

  return { findings, events }
}
