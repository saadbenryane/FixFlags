import { CHECK_REGISTRY } from './check-registry'
import { baseCheckId, parseAffectedPaths } from './flag-identity'
import { checkReceiptSchema } from './checks/receipt'
import { assertionForTarget, scopedAssertionForTarget, checkVerifierSchema } from './checks/verification'
import { searchReceiptSchema, searchVerifierSchema } from './search/contracts'
import { assessSearchRecovery } from './search/recovery'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'

export type RecoveryExecution = { targetKey: string; status: string; detail: unknown }
export type RecoveryFlag = { checkId?: string | null; pageUrl?: string | null; affectedPaths?: unknown; attentionPolicy?: unknown;
  evidenceTargets?: unknown; verificationRule?: string | null }
const recoveryUrl = normalizeVerifierUrl

/** A completed page is not proof that a finding's evaluator completed. */
export function hasRecordedRecoveryEvidence(input: {
  auditId: string; executionSpec: unknown; flag: RecoveryFlag; executions: RecoveryExecution[];
}): boolean {
  const spec = readExecutionSpec(input.executionSpec), checkId = baseCheckId(input.flag.checkId)
  if (!spec || !checkId || !CHECK_REGISTRY[checkId] || spec.checks[checkId] !== CHECK_REGISTRY[checkId].version) return false
  // Field responsiveness describes a trailing window. A fresh lab run cannot prove its repair.
  if (checkId === 'inp-critical' || checkId === 'inp-poor') return false
  const urls = [...new Set([...parseAffectedPaths(input.flag.affectedPaths), ...(input.flag.pageUrl ? [input.flag.pageUrl] : [])].map(recoveryUrl))]
  if (!urls.length) urls.push(recoveryUrl(spec.targetUrl))
  const completed = input.executions.filter(row => row.status === 'COMPLETED')
  return urls.every(url => {
    const exact = completed.filter(row => row.targetKey === 'check:' + checkId).flatMap(row => {
      const check = checkVerifierSchema.safeParse(row.detail), search = searchVerifierSchema.safeParse(row.detail)
      return [...(check.success ? [check.data] : []), ...(search.success ? [search.data] : [])]
    }).filter(proof => proof.auditId === input.auditId && proof.checkId === checkId && recoveryUrl(proof.pageUrl) === url &&
      (!('checkVersion' in proof) || proof.checkVersion === spec.checks[checkId]))
    if (exact.length) return exact.every(proof => proof.comparable && proof.verdict === 'passed')
    const searches = completed.filter(row => row.targetKey.startsWith('module:search')).flatMap(row => {
      const result = searchReceiptSchema.safeParse(row.detail)
      return result.success && result.data.auditId === input.auditId && recoveryUrl(result.data.pageUrl) === url &&
        result.data.observations.some(item => item.checkId === checkId) ? [result.data] : []
    })
    if (searches.length) return searches.every(receipt => assessSearchRecovery(receipt, checkId, input.flag.attentionPolicy).verdict === 'passed')
    const checkModule = CHECK_REGISTRY[checkId]?.module
    const source = checkModule === 'performance' ? 'pagespeed-desktop' : checkModule === 'mobile' ? 'pagespeed-mobile'
      : checkModule === 'keyboard' ? 'keyboard' : checkModule === 'measurement' ? 'browser-network'
        : checkModule === 'security' ? 'original-html' : checkModule === 'security-headers' ? 'http'
          : checkModule === 'accessibility' ? 'axe' : 'rendered-dom'
    const receipts = completed.filter(row => row.targetKey === 'module:' + checkModule).flatMap(row => {
      const result = checkReceiptSchema.safeParse(row.detail)
      return result.success && result.data.module === checkModule && result.data.execution?.auditId === input.auditId &&
        result.data.execution.checkVersion === spec.checks[checkId] && recoveryUrl(result.data.pageUrl) === url &&
        result.data.execution.source === source ? [result.data] : []
    })
    if (checkModule === 'keyboard' || checkModule === 'measurement') {
      const sources = completed.filter(row => row.targetKey === 'module:' + checkModule).flatMap(row => {
        const result = checkReceiptSchema.safeParse(row.detail)
        return result.success ? [result.data] : []
      })
      return receipts.some(receipt => receipt.applicable && !receipt.failed &&
        scopedAssertionForTarget({ receipt, checkId, flag: input.flag, receipts: sources })?.assertion.passed === true)
    }
    return receipts.length > 0 && receipts.every(receipt => {
      if (!receipt.applicable || receipt.failed || receipt.complete === false) return false
      const assertion = assertionForTarget(receipt, checkId)
      // A module can omit a responsibility or succeed on a different assertion.
      // Only a recorded assertion for this exact finding establishes recovery.
      return assertion?.passed === true
    })
  })
}
