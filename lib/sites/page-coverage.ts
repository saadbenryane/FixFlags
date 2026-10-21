import { readExecutionSpec, type ExecutionSpec } from './domain/execution-spec'

export type PageCoverage = { pagesReached: number; pagesExpected: number; complete: boolean }
export type PageCoverageExecution = { targetKey: string; workKind?: string | null; pageUrl?: string | null }
type PageScope = { executionSpec: unknown; pages: readonly { url?: string }[]; executions?: readonly PageCoverageExecution[] }

function pageUrls(input: PageScope, spec: ExecutionSpec | null): string[] {
  if (spec?.category) return [...spec.category.pages]
  const urls = new Set(spec?.scope === 'SITE' ? [spec.targetUrl, ...(spec.monitoringPages ?? [])] : [])
  for (const page of input.pages) if (page.url) urls.add(page.url)
  for (const task of input.executions ?? []) {
    if (task.targetKey.startsWith('task:') && task.workKind === 'browser' && task.pageUrl) urls.add(task.pageUrl)
  }
  return [...urls]
}

/** Use the same recorded responsibility for later admission and current coverage.
 * URL eligibility and the monitoring budget are enforced at admission. */
export function recordedPageUrls(input: PageScope): string[] {
  return pageUrls(input, readExecutionSpec(input.executionSpec))
}

/** Page responsibility comes from admitted scope and discovered task intent.
 * Collection can stop before an AuditPage exists, without retiring that page. */
export function executionPageCoverage(input: {
  executionSpec: unknown;
  pages: readonly { url?: string; status: string }[];
  executions?: readonly PageCoverageExecution[];
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
  return { pagesReached, pagesExpected: expected.length, complete: expected.length > 0 && pagesReached === expected.length }
}
