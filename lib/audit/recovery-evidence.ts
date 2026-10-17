import { CHECK_REGISTRY, CHECK_MODULES } from './check-registry'
import { baseCheckId, parseAffectedPaths } from './flag-identity'
import { checkReceiptSchema, recordedCheckVersion } from './checks/receipt'
import { scopedAssertionForTarget, checkVerifierSchema } from './checks/verification'
import { searchReceiptSchema, searchVerifierSchema } from './search/contracts'
import { assessSearchRecovery } from './search/recovery'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import { RENDERED_PAGE_VERIFICATION_RULE } from './checks/rendered-page-evidence'
import { RESOURCE_REPAIR_RULE, resourceCheckPolicy } from './pagespeed-opportunities'
import { SECURITY_HEADER_VERIFICATION_RULE } from './checks/security-headers'
import { SLOW_REPLAY_VERIFICATION_RULE } from './flow/slow-replay-contract'
import { PAGESPEED_LAB_RULE, performanceLabKey } from './performance-measurement'
import { TAP_TARGET_VERIFICATION_RULE } from './pagespeed-tap-targets'
import { readSupportingObservations } from './flag-observations'

export type RecoveryExecution = { targetKey: string; status: string; detail: unknown }
export type RecoveryFlag = { checkId?: string | null; pageUrl?: string | null; affectedPaths?: unknown; attentionPolicy?: unknown;
  evidenceTargets?: unknown; verificationRule?: string | null; supportingObservations?: unknown }
const recoveryUrl = normalizeVerifierUrl
type Verdict = 'passed' | 'failed' | null
export type RecordedObservationGap = 'UNMEASURED' | 'UNREADABLE' | 'INCOMPLETE_ORIGINAL' | 'MISSING_CHECK' | 'METHOD_CHANGED'

/** Describe why original recorded conditions cannot establish a recovery. */
export function recordedObservationGap(flag: RecoveryFlag, executionSpec: unknown): RecordedObservationGap | null {
  if (flag.supportingObservations == null) return flag.checkId ? null : 'UNMEASURED'
  const observations = readSupportingObservations(flag.supportingObservations)
  if (!observations) return 'UNREADABLE'
  if (observations.items.some(item => !item.checkId)) return 'UNMEASURED'
  if (observations.items.some(item => !item.provenance || !item.pageUrl || !item.checkVersion)) return 'INCOMPLETE_ORIGINAL'
  const spec = readExecutionSpec(executionSpec)
  if (observations.items.some(item => spec?.checks[baseCheckId(item.checkId)!] == null)) return 'MISSING_CHECK'
  if (observations.items.some(item => spec!.checks[baseCheckId(item.checkId)!] !== item.checkVersion)) return 'METHOD_CHANGED'
  return null
}
function combinedVerdict(verdicts: Verdict[]): Verdict {
  if (verdicts.includes('failed')) return 'failed'
  return verdicts.length && verdicts.every(verdict => verdict === 'passed') ? 'passed' : null
}

/** One comparable failure disproves repair; passing requires every original scope. */
export function recordedVerificationVerdict(input: {
  auditId: string; executionSpec: unknown; flag: RecoveryFlag; executions: RecoveryExecution[];
}): Verdict {
  if (input.flag.supportingObservations == null) return recordedConditionVerdict(input)
  const observations = readSupportingObservations(input.flag.supportingObservations)
  if (!observations) return null
  const spec = readExecutionSpec(input.executionSpec)
  return combinedVerdict(observations.items.map(item => {
    if (!item.checkId || !item.checkVersion || !item.provenance || !item.pageUrl ||
      spec?.checks[baseCheckId(item.checkId)!] !== item.checkVersion) return null
    return recordedConditionVerdict({ ...input, flag: { ...input.flag, supportingObservations: undefined,
      checkId: item.checkId, pageUrl: item.pageUrl, affectedPaths: [item.pageUrl],
      verificationRule: item.verificationRule, evidenceTargets: item.evidenceTargets } })
  }))
}

function recordedConditionVerdict(input: {
  auditId: string; executionSpec: unknown; flag: RecoveryFlag; executions: RecoveryExecution[];
}): Verdict {
  const spec = readExecutionSpec(input.executionSpec), checkId = baseCheckId(input.flag.checkId)
  if (!spec || !checkId || !CHECK_REGISTRY[checkId] || !spec.checks[checkId] || spec.checks[checkId] > CHECK_REGISTRY[checkId].version) return null
  // Assess historical conclusions against their recorded admitted version.
  // Fresh runs still require exact original versions above, and canonical
  // evaluation rejects unavailable versions before collecting a new verdict.
  // Field responsiveness describes a trailing window. A fresh lab run cannot prove its repair.
  if (checkId === 'inp-critical' || checkId === 'inp-poor') return null
  if (performanceLabKey(checkId) && input.flag.verificationRule !== PAGESPEED_LAB_RULE) return null
  if (checkId === 'tap-targets-small' && input.flag.verificationRule !== TAP_TARGET_VERIFICATION_RULE) return null
  // A historical summary cannot supply the original resource audit criteria.
  if (resourceCheckPolicy(checkId) && input.flag.verificationRule !== RESOURCE_REPAIR_RULE) return null
  if (CHECK_REGISTRY[checkId].module === 'security-headers' && input.flag.verificationRule !== SECURITY_HEADER_VERIFICATION_RULE) return null
  if (CHECK_REGISTRY[checkId].module === 'slow-replay' && input.flag.verificationRule !== SLOW_REPLAY_VERIFICATION_RULE) return null
  const urls = [...new Set([...parseAffectedPaths(input.flag.affectedPaths), ...(input.flag.pageUrl ? [input.flag.pageUrl] : [])].map(recoveryUrl))]
  if (!urls.length) urls.push(recoveryUrl(spec.targetUrl))
  const completed = input.executions.filter(row => row.status === 'COMPLETED')
  if (['overlays', 'keyboard', 'journeys', 'mobile-navigation', 'corridor'].includes(CHECK_REGISTRY[checkId].module ?? '')) {
    const checkModule = CHECK_REGISTRY[checkId].module
    const receipts = completed.filter(row => row.targetKey === 'module:' + checkModule).flatMap(row => {
      const parsed = checkReceiptSchema.safeParse(row.detail)
      return parsed.success && parsed.data.applicable && !parsed.data.failed && parsed.data.execution?.auditId === input.auditId && recordedCheckVersion(parsed.data, checkId) === spec.checks[checkId] &&
        parsed.data.execution.source === (checkModule === 'keyboard' ? 'keyboard' : 'rendered-dom') ? [parsed.data] : []
    })
    return combinedVerdict(receipts.map(receipt => {
      if (!receipt.applicable || receipt.failed) return null
      const assertion = scopedAssertionForTarget({ receipt, receipts, checkId, flag: input.flag })?.assertion
      return assertion ? assertion.passed ? 'passed' : 'failed' : null
    }).filter(verdict => verdict !== null))
  }
  return combinedVerdict(urls.map(url => {
    const exact = completed.filter(row => row.targetKey === 'check:' + checkId).flatMap(row => {
      const check = checkVerifierSchema.safeParse(row.detail), search = searchVerifierSchema.safeParse(row.detail)
      return [...(check.success ? [check.data] : []), ...(search.success ? [search.data] : [])]
    }).filter(proof => proof.auditId === input.auditId && proof.checkId === checkId && recoveryUrl(proof.pageUrl) === url &&
      (!('checkVersion' in proof) || proof.checkVersion === spec.checks[checkId]))
    const searches = completed.filter(row => row.targetKey.startsWith('module:search')).flatMap(row => {
      const result = searchReceiptSchema.safeParse(row.detail)
      return result.success && result.data.auditId === input.auditId && recoveryUrl(result.data.pageUrl) === url &&
        result.data.observations.some(item => item.checkId === checkId) ? [result.data] : []
    })
    if (searches.length) return combinedVerdict(searches.map(receipt => {
      const result = assessSearchRecovery(receipt, checkId, input.flag.attentionPolicy, input.flag.pageUrl, urls)
      return result.comparable && (result.verdict === 'passed' || result.verdict === 'failed') ? result.verdict : null
    }))
    const checkModule = CHECK_REGISTRY[checkId]?.module
    const source = checkModule === 'performance' ? 'pagespeed-desktop' : checkModule === 'mobile' ? 'pagespeed-mobile'
      : checkModule === 'console' ? 'browser-console' : checkModule === 'keyboard' ? 'keyboard' : checkModule === 'measurement' ? 'browser-network'
        : CHECK_MODULES[checkModule ?? '']?.input === 'http' || checkId === 'broken-internal-links' || ['security', 'security-headers', 'auth-checkout', 'og-image'].includes(checkModule ?? '') ? 'http'
          : checkModule === 'accessibility' ? 'browser-accessibility' : 'rendered-dom'
    const receipts = completed.filter(row => row.targetKey === 'module:' + checkModule).flatMap(row => {
      const result = checkReceiptSchema.safeParse(row.detail)
      return result.success && result.data.module === checkModule && result.data.execution?.auditId === input.auditId &&
        recordedCheckVersion(result.data, checkId) === spec.checks[checkId] && recoveryUrl(result.data.pageUrl) === url &&
        (result.data.execution.source === source || checkModule === 'security' && result.data.execution.source === 'original-html') ? [result.data] : []
    })
    // Derived summaries cannot replace the original condition's source observations.
    if (!receipts.length && !input.flag.verificationRule && !Array.isArray(input.flag.evidenceTargets) && exact.length)
      return combinedVerdict(exact.map(proof => proof.comparable ? proof.verdict === 'unknown' ? null : proof.verdict : null))
    if (input.flag.verificationRule === RENDERED_PAGE_VERIFICATION_RULE || ['broken-internal-links', 'broken-page-anchors'].includes(checkId) || ['slow-replay', 'page-response', 'overlays', 'flow', 'accessibility', 'console', 'keyboard', 'measurement', 'auth-checkout', 'og-image', 'form-validation'].includes(checkModule ?? '')) {
      const sources = completed.filter(row => row.targetKey === 'module:' + checkModule).flatMap(row => {
        const result = checkReceiptSchema.safeParse(row.detail)
        return result.success && !result.data.failed ? [result.data] : []
      })
      return combinedVerdict(receipts.map(receipt => {
        if (!receipt.applicable || receipt.failed) return null
        const assertion = scopedAssertionForTarget({ receipt, checkId, flag: input.flag, receipts: sources })?.assertion
        return assertion ? assertion.passed ? 'passed' : 'failed' : null
      }).filter(verdict => verdict !== null))
    }
    return combinedVerdict(receipts.map(receipt => {
      if (!receipt.applicable || receipt.failed) return null
      const assertion = scopedAssertionForTarget({ receipt, checkId, flag: input.flag })?.assertion
      // A module can omit a responsibility or succeed on a different assertion.
      // Only a recorded assertion for this exact finding establishes recovery.
      return assertion ? assertion.passed ? 'passed' : 'failed' : null
    }))
  }))
}

/** A completed page is not proof that a finding's evaluator completed. */
export function hasRecordedRecoveryEvidence(input: Parameters<typeof recordedVerificationVerdict>[0]): boolean {
  return recordedVerificationVerdict(input) === 'passed'
}
