import { readExecutionSpec, type ExecutionSpec } from './domain/execution-spec'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { SEARCH_DEFINITIONS } from '@/lib/audit/search/definitions'
import { primaryActionControlKey } from '@/lib/audit/flow/action-context'
import { CHECK_ASSERTIONS } from '@/lib/audit/checks/definitions'
import { readCheckReceipt, recordedCheckVersion } from '@/lib/audit/checks/receipt'
import { destinationContext } from '@/lib/audit/checks/destination-evidence'
import { matchesRecordedVerifierTask } from '@/lib/improvements/verifier-scope'

export type PageCoverage = { pagesReached: number; pagesExpected: number; complete: boolean }
export type PageCoverageExecution = { targetKey: string; workKind?: string | null; pageUrl?: string | null; status?: string; detail?: unknown; taskId?: string | null }
type PageScope = { executionSpec: unknown; pages: readonly { url?: string }[]; executions?: readonly PageCoverageExecution[] }
export type PageObservationScope = { auditId: string; pages: readonly string[] }
type LabAssertions = Readonly<Record<string, ReadonlyArray<readonly [id: string, version: number]>>>
export type RecordedPageEvidenceScope = PageObservationScope & {
  search: boolean; securityTransport: boolean; accessibility?: { automated: boolean; keyboard: boolean }; tracking?: boolean;
  conversion?: ReadonlyMap<string, readonly string[]>;
  performance?: { desktop: LabAssertions; mobile: LabAssertions };
}

function pageUrls(input: PageScope, spec: ExecutionSpec | null): string[] {
  if (spec?.category) return [...spec.category.pages]
  const urls = new Set(spec?.scope === 'SITE' ? [spec.targetUrl, ...(spec.monitoringPages ?? [])] : [])
  for (const page of input.pages) if (page.url) urls.add(page.url)
  for (const task of input.executions ?? []) {
    if (task.workKind === 'browser' && task.pageUrl) urls.add(task.pageUrl)
  }
  return [...urls]
}

/** Use the same recorded responsibility for later admission and current coverage.
 * URL eligibility and the monitoring budget are enforced at admission. */
export function recordedPageUrls(input: PageScope): string[] {
  return pageUrls(input, readExecutionSpec(input.executionSpec))
}

/** Current page evidence follows the original admission and recorded discovery. */
export function recordedPageEvidenceScope(audit: { id: string; executionSpec?: unknown; pages?: readonly { url?: string }[];
  verifierExecutions?: readonly PageCoverageExecution[] }): RecordedPageEvidenceScope | undefined {
  const spec = readExecutionSpec(audit.executionSpec)
  if (spec?.engine !== 'progressive-v1' || !['SITE', 'CATEGORY'].includes(spec.scope)) return undefined
  const search = (spec.scope === 'SITE' || spec.category?.area === 'search') &&
    SEARCH_DEFINITIONS.some(definition => definition.evaluator !== 'google' &&
      definition.checkIds.some(id => Object.hasOwn(spec.checks, id)))
  const modules = new Set(Object.keys(spec.checks).map(id => CHECK_REGISTRY[id]?.module))
  const securityTransport = (spec.scope === 'SITE' || spec.category?.area === 'security') && modules.has('security')
  const accessibility = (spec.scope === 'SITE' || spec.category?.area === 'accessibility') &&
    (modules.has('accessibility') || modules.has('keyboard'))
    ? { automated: modules.has('accessibility'), keyboard: modules.has('keyboard') } : undefined
  const tracking = (spec.scope === 'SITE' || spec.category?.area === 'tracking') && modules.has('measurement')
  const checksConversion = spec.category ? spec.category.area === 'conversion'
    : Object.keys(spec.checks).some(id => CHECK_REGISTRY[id]?.area === 'conversion')
  const conversionPages = checksConversion ? spec.category?.pages ?? [...new Set([spec.targetUrl, ...(spec.monitoringEntryPages ?? []),
    ...(spec.monitoringBehaviors ?? []).filter(item => item.behaviors.includes('flow')).map(item => item.pageUrl)])] : undefined
  const retainedControls = new Map(spec.monitoringBehaviors?.map(item => [item.pageUrl,
    (item.actionContexts ?? []).filter(context => primaryActionControlKey(context))]))
  const conversion = conversionPages && new Map(conversionPages.map(url => [url, retainedControls.get(url) ?? []]))
  const labAssertions = (module: 'performance' | 'mobile'): LabAssertions => Object.fromEntries(
    Object.entries(CHECK_ASSERTIONS[module]).flatMap(([key, definition]) => {
      const checks = definition.verifies.filter(id => Object.hasOwn(spec.checks, id)).map(id => [id, spec.checks[id]] as const)
      return definition.area === 'performance' && checks.length ? [[key, checks] as const] : []
    }))
  const desktop = labAssertions('performance'), mobile = labAssertions('mobile')
  const performance = (!spec.category || spec.category.area === 'performance') && (Object.keys(desktop).length || Object.keys(mobile).length)
    ? { desktop, mobile } : undefined
  if (!search && !securityTransport && !accessibility && !tracking && !conversion && !performance) return undefined
  return { auditId: audit.id, search, securityTransport, accessibility, tracking, ...(conversion ? { conversion } : {}),
    ...(performance ? { performance } : {}), pages: pageUrls({
    executionSpec: spec, pages: audit.pages ?? [], executions: audit.verifierExecutions,
  }, spec) }
}

export function requiredPublicResponseChecks(spec: ExecutionSpec) {
  if (spec.engine !== 'progressive-v1') return []
  return CHECK_ASSERTIONS['page-response']['page-response'].verifies
    .filter(id => Object.hasOwn(spec.checks, id)).map(id => [id, spec.checks[id]] as const)
}

export function recordedPublicResponseCoversPage(auditId: string, checks: ReadonlyArray<readonly [string, number]>, execution: PageCoverageExecution) {
  const page = execution.pageUrl
  if (execution.targetKey !== 'module:page-response' || execution.status !== 'COMPLETED' || !page) return false
  const receipt = readCheckReceipt(execution.detail)
  if (receipt.legacy || receipt.module !== 'page-response' || receipt.pageUrl !== page || !receipt.applicable || receipt.complete !== true ||
    receipt.execution?.auditId !== auditId || receipt.execution.source !== 'http' ||
    !matchesRecordedVerifierTask(execution.taskId, receipt.execution.taskId) ||
    !checks.every(([id, version]) => recordedCheckVersion(receipt, id) === version)) return false
  const context = destinationContext(page, page)
  return receipt.assertions.some(assertion => assertion.key === 'page-response' && assertion.context === context &&
    assertion.complete === true && assertion.disposition !== 'observed')
}

export function recordedPublicResponsesComplete(auditId: string | undefined, expected: readonly string[], spec: ExecutionSpec,
  executions: readonly PageCoverageExecution[]) {
  const checks = requiredPublicResponseChecks(spec)
  if (!checks.length) return true
  if (!auditId) return false
  const unverified = new Set(expected)
  for (const execution of executions) {
    const page = execution.pageUrl
    if (page && unverified.has(page) && recordedPublicResponseCoversPage(auditId, checks, execution)) unverified.delete(page)
  }
  return unverified.size === 0
}

/** The inventory measures page collection. A conclusive response is also
 * required for each page when that independent check was admitted. */
export function executionPageCoverage(input: {
  auditId?: string;
  executionSpec: unknown;
  pages: readonly { url?: string; status: string }[];
  executions?: readonly PageCoverageExecution[];
  failedModules?: unknown;
}): PageCoverage {
  const spec = readExecutionSpec(input.executionSpec)
  if (spec?.scope !== 'SITE' && !spec?.category) {
    const pagesReached = input.pages.filter(page => page.status === 'COMPLETED').length
    const unknownProgressive = !spec && input.executionSpec && typeof input.executionSpec === 'object' &&
      'engine' in input.executionSpec && input.executionSpec.engine === 'progressive-v1'
    return { pagesReached, pagesExpected: input.pages.length,
      complete: !unknownProgressive && input.pages.length > 0 && pagesReached === input.pages.length }
  }
  const expected = pageUrls(input, spec)
  const completed = new Map<string, boolean>()
  for (const page of input.pages) if (page.url) {
    completed.set(page.url, (completed.get(page.url) ?? true) && page.status === 'COMPLETED')
  }
  const pagesReached = expected.filter(url => completed.get(url) === true).length
  const discoveryIncomplete = spec.engine === 'progressive-v1' && Array.isArray(input.failedModules) && input.failedModules.includes('discovery')
  const complete = !discoveryIncomplete && expected.length > 0 && pagesReached === expected.length &&
    recordedPublicResponsesComplete(input.auditId, expected, spec, input.executions ?? [])
  return { pagesReached, pagesExpected: expected.length, complete }
}
