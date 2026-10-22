import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import type { SafeFormBindingConfig } from './binding-config'
import { executeSafeFormFixture } from './safe-form-executor'
import { safeFormFlagCopy } from './binding-assessment'
import { recordBindingEvidence, type BindingObservation } from './binding-evidence'

export async function runSignupBinding(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  projectId: string
  config: SafeFormBindingConfig
  fixtureVersion?: number
  allowLocalhost: boolean
}): Promise<void> {
  const result = await executeSafeFormFixture({
    projectId: input.projectId,
    fixtureId: input.config.fixtureId,
    expectedVersion: input.fixtureVersion,
    startUrl: input.config.startUrl,
    allowLocalhost: input.allowLocalhost,
  })
  // A safe form is submitted exactly once. The fixture is already proven reversible,
  // because a run that cannot prove its pre-run reset or its cleanup is BLOCKED rather
  // than FAILED, so the single attempt is conclusive and never becomes a blind resubmit.
  const copy = result.disposition === 'FAILED' ? safeFormFlagCopy(result.reason) : null
  const observation: BindingObservation = { disposition: result.disposition, reason: result.reason, detail: result.detail }
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: 'SAFE_FORM',
    attempts: [observation],
    conclusive: observation,
    flag: copy ? { auditId: input.auditId, checkId: 'outcome-signup-failed', rubric: 'EXPERIENCE', severity: 'CRITICAL', impactTag: 'CONVERSION',
      problem: copy.problem, evidence: copy.evidence, fix: copy.fix,
      whyItMatters: 'People may be unable to complete signup while its completion response is missing.',
      confidence: 0.95, source: 'DETERMINISTIC', pageUrl: input.config.startUrl,
      fingerprint: outcomeFlagFingerprint(input.outcomeId, input.bindingKey), position: 1,
      verificationRule: 'Run the same authorized fixture version and required bindings. Confirm a new success signal after submission, with proven reset and cleanup.',
    } : undefined,
  })
}
