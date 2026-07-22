export type McpCaller = (
  tool: string,
  args: Record<string, unknown>
) => Promise<unknown>

export interface CheckResult {
  reportId: string
  reportUrl: string
  status: string
  score?: number | null
  verdict?: string | null
  rubrics?: Array<{
    name: string
    status?: string
    flagCount?: number
    criticalCount?: number
    importantCount?: number
  }>
  finishPlan?: FinishPlan
}

export interface FinishPlan {
  reportId: string
  url?: string
  items: Array<{
    flagId?: string
    checkId?: string | null
    problem: string
    rubric: string
    severity: string
    impactTag?: string | null
    fixPrompt?: string | null
  }>
  planPrompt?: string
}

export interface RecheckResult {
  parentReportId: string
  reportId: string
  reportUrl: string
  status: string
  diff: {
    fixed: number
    remaining: number
    newIssues: number
    regressed: number
  } | null
  nextFixes: FinishPlan['items']
}

interface CheckOptions {
  wait: boolean
  single: boolean
  apiBase: string
}

export async function checkAndPlan(
  call: McpCaller,
  url: string,
  options: CheckOptions
): Promise<CheckResult> {
  const outcome = (await call('ff_check_and_plan', {
    url,
    waitForCompletion: options.wait,
    mode: options.single ? 'single' : 'critical_path',
  })) as Partial<CheckResult>

  if (!outcome.reportId) throw new Error('FixFlags did not return a report ID')
  if (outcome.status === 'FAILED') throw new Error(`Check ${outcome.reportId} failed`)
  return {
    reportId: outcome.reportId,
    reportUrl:
      outcome.reportUrl ?? `${options.apiBase.replace(/\/$/, '')}/report/${outcome.reportId}`,
    status: outcome.status ?? 'QUEUED',
    score: outcome.score ?? null,
    verdict: outcome.verdict ?? null,
    rubrics: outcome.rubrics ?? [],
    finishPlan: outcome.finishPlan,
  }
}

interface RecheckOptions {
  wait: boolean
}

export async function recheckAndDiff(
  call: McpCaller,
  parentReportId: string,
  options: RecheckOptions
): Promise<RecheckResult> {
  const outcome = (await call('ff_recheck_and_compare', {
    parentReportId,
    waitForCompletion: options.wait,
  })) as Partial<RecheckResult>

  if (!outcome.reportId) throw new Error('FixFlags did not return a re-check report ID')
  if (outcome.status === 'FAILED') throw new Error(`Re-check ${outcome.reportId} failed`)
  return {
    parentReportId,
    reportId: outcome.reportId,
    reportUrl: outcome.reportUrl ?? '',
    status: outcome.status ?? 'QUEUED',
    diff: outcome.diff ?? null,
    nextFixes: outcome.nextFixes ?? [],
  }
}
