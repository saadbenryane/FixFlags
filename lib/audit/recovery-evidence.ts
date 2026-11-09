import { CHECK_REGISTRY, executionCheckModule } from './check-registry'
import { CHECK_MODULES } from '@/lib/audit/checks/definitions'
import { baseCheckId, parseAffectedPaths } from './flag-identity'
import { checkReceiptSchema, recordedCheckVersion } from './checks/receipt'
import { scopedAssertionForTarget, checkVerifierSchema } from './checks/verification'
import { currentPageResponseObservation } from './checks/assertion'
import { classifyRecordedSearchReceipt, searchVerifierSchema, type SearchReceipt } from './search/contracts'
import { assessSearchRecovery } from './search/recovery'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { matchesRecordedVerifierPage, matchesRecordedVerifierTask, normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import { RENDERED_PAGE_VERIFICATION_RULE } from './checks/rendered-page-evidence'
import { RESOURCE_REPAIR_RULE, resourceCheckPolicy } from './pagespeed-opportunities'
import { SECURITY_HEADER_VERIFICATION_RULE } from './checks/security-headers'
import { SLOW_REPLAY_VERIFICATION_RULE } from './flow/slow-replay-contract'
import { corridorVerificationSource } from './checks/corridor-contract'
import { PAGESPEED_LAB_RULE, performanceLabKey } from './performance-measurement'
import { TAP_TARGET_VERIFICATION_RULE } from './pagespeed-tap-targets'
import { readSupportingObservations, type SupportingObservation } from './flag-observations'
import type { z } from 'zod'

export type RecoveryExecution = { targetKey: string; status: string; detail: unknown; auditId?: string; pageUrl?: string | null; taskId?: string | null;
  task?: { id: string; pageUrl: string | null } | null }
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
  if (flag.attentionPolicy != null && observations.items.some(item => item.attentionPolicy === undefined)) return 'INCOMPLETE_ORIGINAL'
  const spec = readExecutionSpec(executionSpec)
  if (observations.items.some(item => spec?.checks[baseCheckId(item.checkId)!] == null)) return 'MISSING_CHECK'
  if (observations.items.some(item => spec!.checks[baseCheckId(item.checkId)!] !== item.checkVersion)) return 'METHOD_CHANGED'
  return null
}
function requiredScopeVerdict(verdicts: Verdict[]): Verdict {
  if (verdicts.includes('failed')) return 'failed'
  return verdicts.length && verdicts.every(verdict => verdict === 'passed') ? 'passed' : null
}

/** Each candidate has already been compared with the same original condition. */
function comparableObservationVerdict(verdicts: Verdict[]): Verdict {
  if (verdicts.includes('failed')) return 'failed'
  return verdicts.includes('passed') ? 'passed' : null
}

type CheckReceipt = z.infer<typeof checkReceiptSchema>
type ExactProof = z.infer<typeof checkVerifierSchema> | z.infer<typeof searchVerifierSchema>
export type RecordedRecoveryReader = Readonly<{
  auditId: string;
  verdict: (flag: RecoveryFlag) => Verdict;
  hasRecovery: (flag: RecoveryFlag) => boolean;
}>
type RecoverySnapshot = {
  auditId: string;
  spec: ReturnType<typeof readExecutionSpec>;
  modules: Map<string, CheckReceipt[]>;
  searches: Map<string, SearchReceipt[]>;
  rejectedSearches: Set<string>;
  exact: Map<string, ExactProof[]>;
}
const observationKey = (checkId: string, pageUrl: string) => JSON.stringify([checkId, recoveryUrl(pageUrl)])
const ACTION_DESTINATION_MODULES = new Set(['journeys', 'overlays', 'form-validation'])
function append<T>(index: Map<string, T[]>, key: string, value: T) {
  const rows = index.get(key)
  if (rows) rows.push(value)
  else index.set(key, [value])
}

/** Validate one selected recovery snapshot once. Parsed receipts and the admitted
 * scope are private copies, never a cache shared with another database read.
 * Each original condition still receives its own scope and method comparison. */
export function createRecordedRecoveryReader(input: {
  auditId: string; executionSpec: unknown; executions: RecoveryExecution[];
}): RecordedRecoveryReader {
  const snapshot: RecoverySnapshot = { auditId: input.auditId, spec: readExecutionSpec(input.executionSpec),
    modules: new Map(), searches: new Map(), rejectedSearches: new Set(), exact: new Map() }
  const admittedPages = snapshot.spec?.category && new Set(snapshot.spec.category.pages.map(recoveryUrl))
  const matchesLedger = (row: RecoveryExecution, auditId: string | undefined, pageUrl: string, module?: string, taskId?: string) => {
    if (auditId !== snapshot.auditId || row.auditId !== undefined && row.auditId !== auditId || !matchesRecordedVerifierPage(row.pageUrl, pageUrl)) return false
    if (taskId && !matchesRecordedVerifierTask(row.taskId ?? row.task?.id, taskId)) return false
    if (!admittedPages || admittedPages.has(recoveryUrl(pageUrl))) return true
    // Some checks observe a destination while running an action from an admitted page.
    const task = row.task
    return module !== undefined && ACTION_DESTINATION_MODULES.has(module) && task?.id === taskId &&
      Boolean(task?.pageUrl && admittedPages.has(recoveryUrl(task.pageUrl)))
  }
  if (snapshot.spec) for (const row of input.executions) {
    if (row.status !== 'COMPLETED') continue
    if (row.targetKey.startsWith('module:search')) {
      const parsed = classifyRecordedSearchReceipt(row)
      if (parsed.state === 'recorded' && matchesLedger(row, parsed.receipt.auditId, parsed.receipt.pageUrl)) {
        for (const checkId of parsed.rejectedCheckIds) snapshot.rejectedSearches.add(observationKey(checkId, parsed.receipt.pageUrl))
        for (const checkId of new Set(parsed.receipt.observations.map(item => item.checkId)))
          append(snapshot.searches, observationKey(checkId, parsed.receipt.pageUrl), parsed.receipt)
      }
    }
    if (row.targetKey.startsWith('module:')) {
      const parsed = checkReceiptSchema.safeParse(row.detail)
      if (parsed.success && row.targetKey === 'module:' + parsed.data.module &&
        matchesLedger(row, parsed.data.execution?.auditId, parsed.data.pageUrl, parsed.data.module, parsed.data.execution?.taskId))
        append(snapshot.modules, row.targetKey, parsed.data)
    } else if (row.targetKey.startsWith('check:')) {
      for (const schema of [checkVerifierSchema, searchVerifierSchema]) {
        const parsed = schema.safeParse(row.detail)
        if (parsed.success && (!('assertion' in parsed.data) || currentPageResponseObservation(parsed.data.assertion)) &&
          row.targetKey === 'check:' + parsed.data.checkId && matchesLedger(row, parsed.data.auditId, parsed.data.pageUrl,
          CHECK_REGISTRY[parsed.data.checkId]?.module, 'taskId' in parsed.data ? parsed.data.taskId : undefined))
          append(snapshot.exact, observationKey(parsed.data.checkId, parsed.data.pageUrl), parsed.data)
      }
    }
  }
  const verdict = (flag: RecoveryFlag) => recordedFlagVerdict(flag, snapshot)
  return { auditId: input.auditId, verdict, hasRecovery: flag => verdict(flag) === 'passed' }
}

/** One comparable failure disproves repair; passing requires every original scope. */
export function recordedVerificationVerdict(input: {
  auditId: string; executionSpec: unknown; flag: RecoveryFlag; executions: RecoveryExecution[];
}): Verdict {
  return createRecordedRecoveryReader(input).verdict(input.flag)
}

function recordedFlagVerdict(flag: RecoveryFlag, snapshot: RecoverySnapshot): Verdict {
  if (flag.supportingObservations == null) return recordedConditionVerdict(flag, snapshot)
  const observations = readSupportingObservations(flag.supportingObservations)
  if (!observations) return null
  const { spec } = snapshot
  return requiredScopeVerdict(observations.items.map(item => {
    if (!item.checkId || !item.checkVersion || !item.provenance || !item.pageUrl ||
      spec?.checks[baseCheckId(item.checkId)!] !== item.checkVersion) return null
    // Missing historical custody cannot borrow a later representative's Search
    // source, entity, property or resource constraints.
    if (item.attentionPolicy === undefined && flag.attentionPolicy != null) return null
    return recordedConditionVerdict({ ...flag, supportingObservations: undefined,
      checkId: item.checkId, pageUrl: item.pageUrl, affectedPaths: [item.pageUrl],
      verificationRule: item.verificationRule, evidenceTargets: item.evidenceTargets, attentionPolicy: item.attentionPolicy }, snapshot, item)
  }))
}

function recordedConditionVerdict(flag: RecoveryFlag, snapshot: RecoverySnapshot, original?: SupportingObservation): Verdict {
  const { spec } = snapshot, checkId = baseCheckId(flag.checkId)
  if (!spec || !checkId || !CHECK_REGISTRY[checkId] || !spec.checks[checkId] || spec.checks[checkId] > CHECK_REGISTRY[checkId].version) return null
  // Assess historical conclusions against their recorded admitted version.
  // Fresh runs still require exact original versions above, and canonical
  // evaluation rejects unavailable versions before collecting a new verdict.
  // Field responsiveness describes a trailing window. A fresh lab run cannot prove its repair.
  if (checkId === 'inp-critical' || checkId === 'inp-poor') return null
  if (performanceLabKey(checkId) && flag.verificationRule !== PAGESPEED_LAB_RULE) return null
  if (checkId === 'tap-targets-small' && flag.verificationRule !== TAP_TARGET_VERIFICATION_RULE) return null
  // A historical summary cannot supply the original resource audit criteria.
  if (resourceCheckPolicy(checkId) && flag.verificationRule !== RESOURCE_REPAIR_RULE) return null
  if (CHECK_REGISTRY[checkId].module === 'security-headers' && flag.verificationRule !== SECURITY_HEADER_VERIFICATION_RULE) return null
  if (CHECK_REGISTRY[checkId].module === 'slow-replay' && flag.verificationRule !== SLOW_REPLAY_VERIFICATION_RULE) return null
  const urls = [...new Set([...parseAffectedPaths(flag.affectedPaths), ...(flag.pageUrl ? [flag.pageUrl] : [])].map(recoveryUrl))]
  if (!urls.length) urls.push(recoveryUrl(spec.targetUrl))
  if (['overlays', 'keyboard', 'journeys', 'mobile-navigation', 'corridor'].includes(CHECK_REGISTRY[checkId].module ?? '')) {
    const checkModule = CHECK_REGISTRY[checkId].module
    const evidenceSource = checkModule === 'corridor' ? corridorVerificationSource(flag.verificationRule)
      : checkModule === 'keyboard' ? 'keyboard' : 'rendered-dom'
    const receipts = (snapshot.modules.get('module:' + checkModule) ?? []).filter(receipt => receipt.applicable && !receipt.failed &&
      recordedCheckVersion(receipt, checkId) === spec.checks[checkId] &&
      receipt.execution?.source === evidenceSource)
    return comparableObservationVerdict(receipts.map(receipt => {
      const assertion = scopedAssertionForTarget({ receipt, receipts, checkId, flag })?.assertion
      return assertion ? assertion.passed ? 'passed' : 'failed' : null
    }))
  }
  return requiredScopeVerdict(urls.map(url => {
    const key = observationKey(checkId, url)
    const exact = (snapshot.exact.get(key) ?? []).filter(proof => proof.kind === 'search-verifier'
      ? !snapshot.rejectedSearches.has(key) : proof.checkVersion === spec.checks[checkId])
    const searches = snapshot.searches.get(key) ?? []
    if (searches.length) return comparableObservationVerdict(searches.map(receipt => {
      const result = assessSearchRecovery(receipt, checkId, flag.attentionPolicy, flag.pageUrl, urls, original)
      return result.comparable && (result.verdict === 'passed' || result.verdict === 'failed') ? result.verdict : null
    }))
    const checkModule = executionCheckModule(checkId, spec.checks[checkId])
    const source = checkModule === 'performance' ? 'pagespeed-desktop' : checkModule === 'mobile' ? 'pagespeed-mobile'
      : checkModule === 'console' ? 'browser-console' : checkModule === 'keyboard' ? 'keyboard' : checkModule === 'measurement' || checkModule === 'network' ? 'browser-network'
        : CHECK_MODULES[checkModule ?? '']?.input === 'http' || checkId === 'broken-internal-links' || ['security', 'security-headers', 'auth-checkout', 'og-image'].includes(checkModule ?? '') ? 'http'
          : checkModule === 'accessibility' ? 'browser-accessibility' : 'rendered-dom'
    const moduleReceipts = snapshot.modules.get('module:' + checkModule) ?? []
    const receipts = moduleReceipts.filter(receipt => recordedCheckVersion(receipt, checkId) === spec.checks[checkId] &&
      recoveryUrl(receipt.pageUrl) === url &&
      (receipt.execution?.source === source || checkModule === 'security' && receipt.execution?.source === 'original-html'))
    // Derived summaries cannot replace the original condition's source observations.
    if (!receipts.length && !flag.verificationRule && !Array.isArray(flag.evidenceTargets) && exact.length)
      return comparableObservationVerdict(exact.map(proof => proof.comparable && proof.verdict !== 'unknown' ? proof.verdict : null))
    const contextual = flag.verificationRule === RENDERED_PAGE_VERIFICATION_RULE ||
      ['broken-internal-links', 'broken-page-anchors'].includes(checkId) ||
      ['slow-replay', 'page-response', 'flow', 'accessibility', 'console', 'measurement', 'network', 'auth-checkout', 'og-image', 'form-validation'].includes(checkModule ?? '')
    const sources = contextual ? moduleReceipts.filter(receipt => !receipt.failed) : undefined
    return comparableObservationVerdict(receipts.map(receipt => {
      if (!receipt.applicable || receipt.failed) return null
      const assertion = scopedAssertionForTarget({ receipt, checkId, flag, receipts: sources,
        originalObservations: original ? [original] : undefined })?.assertion
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
