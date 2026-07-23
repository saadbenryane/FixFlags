export type McpCaller = (tool: string, args: Record<string, unknown>) => Promise<unknown>

export interface FinishPlanItem {
  flagId?: string
  checkId?: string | null
  problem: string
  rubric: string
  severity: string
  impactTag?: string | null
  fixPrompt?: string | null
}

export interface FinishPlan {
  reportId: string
  url?: string
  items: FinishPlanItem[]
  planPrompt?: string
}

export interface FixList extends FinishPlan {
  totalCount?: number
}

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
  fixList?: FixList
  finishPlan?: FinishPlan
}

export interface RecheckResult {
  parentReportId: string
  reportId: string
  reportUrl: string
  status: string
  diff?: { fixed: number; remaining: number; newIssues: number; regressed: number } | null
  nextFinishPlan?: FinishPlan
  nextFixList?: FixList
}

interface WaitOptions {
  wait: boolean
  pollIntervalMs?: number
  maxWaitMs?: number
}

interface CheckOptions extends WaitOptions {
  single: boolean
  apiBase: string
}

function record(value: unknown, tool: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Malformed response from ${tool}: expected an object`)
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown, field: string, tool: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`Malformed response from ${tool}: ${field} must be a non-empty string`)
  }
  return value
}

function optionalNumber(value: unknown, field: string, tool: string): number | null | undefined {
  if (value === undefined || value === null) return value
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Malformed response from ${tool}: ${field} must be a number or null`)
  }
  return value
}

function parseFinishPlan(value: unknown, tool: string): FinishPlan | undefined {
  if (value === undefined) return undefined
  const plan = record(value, tool)
  if (!Array.isArray(plan.items)) {
    throw new Error(`Malformed response from ${tool}: finishPlan.items must be an array`)
  }
  const items = plan.items.map((raw, index): FinishPlanItem => {
    const item = record(raw, tool)
    return {
      flagId: typeof item.flagId === 'string' ? item.flagId : undefined,
      checkId: typeof item.checkId === 'string' || item.checkId === null ? item.checkId : undefined,
      problem: requiredString(item.problem, `finishPlan.items[${index}].problem`, tool),
      rubric: requiredString(item.rubric, `finishPlan.items[${index}].rubric`, tool),
      severity: requiredString(item.severity, `finishPlan.items[${index}].severity`, tool),
      impactTag: typeof item.impactTag === 'string' || item.impactTag === null ? item.impactTag : undefined,
      fixPrompt: typeof item.fixPrompt === 'string' || item.fixPrompt === null ? item.fixPrompt : undefined,
    }
  })
  return {
    reportId: requiredString(plan.reportId, 'finishPlan.reportId', tool),
    url: typeof plan.url === 'string' ? plan.url : undefined,
    items,
    planPrompt: typeof plan.planPrompt === 'string' ? plan.planPrompt : undefined,
  }
}

function parseFixList(value: unknown, tool: string): FixList | undefined {
  if (value === undefined) return undefined
  const parsed = parseFinishPlan(value, tool)
  if (!parsed) return undefined
  const list = record(value, tool)
  return {
    ...parsed,
    totalCount:
      typeof list.totalCount === 'number' && Number.isFinite(list.totalCount)
        ? list.totalCount
        : parsed.items.length,
  }
}

function parseCheck(value: unknown, tool: string, apiBase: string): CheckResult {
  const outcome = record(value, tool)
  const reportId = requiredString(outcome.reportId, 'reportId', tool)
  const status = requiredString(outcome.status, 'status', tool)
  const rubrics = outcome.rubrics === undefined
    ? undefined
    : Array.isArray(outcome.rubrics)
      ? outcome.rubrics.map((raw, index) => {
          const rubric = record(raw, tool)
          return {
            name: requiredString(rubric.name, `rubrics[${index}].name`, tool),
            status: typeof rubric.status === 'string' ? rubric.status : undefined,
            flagCount: optionalNumber(rubric.flagCount, `rubrics[${index}].flagCount`, tool) ?? undefined,
            criticalCount: optionalNumber(rubric.criticalCount, `rubrics[${index}].criticalCount`, tool) ?? undefined,
            importantCount: optionalNumber(rubric.importantCount, `rubrics[${index}].importantCount`, tool) ?? undefined,
          }
        })
      : (() => { throw new Error(`Malformed response from ${tool}: rubrics must be an array`) })()
  return {
    reportId,
    reportUrl: typeof outcome.reportUrl === 'string'
      ? outcome.reportUrl
      : `${apiBase.replace(/\/$/, '')}/report/${reportId}`,
    status,
    score: optionalNumber(outcome.score, 'score', tool),
    verdict: typeof outcome.verdict === 'string' || outcome.verdict === null ? outcome.verdict : undefined,
    rubrics,
    fixList: parseFixList(outcome.fixList, tool),
    finishPlan: parseFinishPlan(outcome.finishPlan, tool),
  }
}

function parseDiff(value: unknown, tool: string): RecheckResult['diff'] {
  if (value === undefined || value === null) return value
  const diff = record(value, tool)
  const number = (field: string) => {
    const parsed = optionalNumber(diff[field], `diff.${field}`, tool)
    if (parsed === undefined || parsed === null) throw new Error(`Malformed response from ${tool}: diff.${field} is required`)
    return parsed
  }
  return { fixed: number('fixed'), remaining: number('remaining'), newIssues: number('newIssues'), regressed: number('regressed') }
}

function parseRecheck(value: unknown, tool: string, apiBase: string, fallbackParent: string): RecheckResult {
  const outcome = record(value, tool)
  const reportId = requiredString(outcome.reportId, 'reportId', tool)
  return {
    parentReportId: typeof outcome.parentReportId === 'string' ? outcome.parentReportId : fallbackParent,
    reportId,
    reportUrl: typeof outcome.reportUrl === 'string' ? outcome.reportUrl : `${apiBase.replace(/\/$/, '')}/report/${reportId}`,
    status: requiredString(outcome.status, 'status', tool),
    diff: parseDiff(outcome.diff, tool),
    nextFixList: parseFixList(outcome.nextFixList, tool),
    nextFinishPlan: parseFinishPlan(outcome.nextFinishPlan, tool),
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForReport(call: McpCaller, reportId: string, options: WaitOptions): Promise<unknown> {
  const deadline = Date.now() + (options.maxWaitMs ?? 5 * 60_000)
  while (Date.now() <= deadline) {
    const status = record(await call('ff_get_check_status', { reportId }), 'ff_get_check_status')
    const state = requiredString(status.status, 'status', 'ff_get_check_status')
    if (state === 'FAILED') throw new Error(`Check ${reportId} failed`)
    if (state === 'COMPLETED') return call('ff_get_report', { reportId })
    await delay(options.pollIntervalMs ?? 2_000)
  }
  throw new Error(`Check ${reportId} did not complete before the CLI wait limit`)
}

export async function checkAndPlan(call: McpCaller, url: string, options: CheckOptions): Promise<CheckResult> {
  let result = parseCheck(await call('ff_check_and_plan', {
    url,
    waitForCompletion: options.wait,
    mode: options.single ? 'single' : 'critical_path',
  }), 'ff_check_and_plan', options.apiBase)
  if (result.status === 'FAILED') throw new Error(`Check ${result.reportId} failed`)
  if (options.wait && result.status !== 'COMPLETED') {
    result = parseCheck(await waitForReport(call, result.reportId, options), 'ff_get_report', options.apiBase)
  }
  return result
}

export async function recheckAndDiff(
  call: McpCaller,
  parentReportId: string,
  options: WaitOptions & { apiBase?: string }
): Promise<RecheckResult> {
  const apiBase = options.apiBase ?? 'https://fixflags.com'
  let result = parseRecheck(await call('ff_recheck_and_compare', {
    parentReportId,
    waitForCompletion: options.wait,
  }), 'ff_recheck_and_compare', apiBase, parentReportId)
  if (result.status === 'FAILED') throw new Error(`Re-check ${result.reportId} failed`)
  if (options.wait && result.status !== 'COMPLETED') {
    result = parseRecheck(await waitForReport(call, result.reportId, options), 'ff_get_report', apiBase, parentReportId)
  }
  return result
}
