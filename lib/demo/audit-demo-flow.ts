import { getAuditBrowser } from '@/lib/audit/screenshot'
import { runFlowScanStandalone } from '@/lib/audit/flow/run-flow-scan'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import type { DeterministicFlag } from '@/lib/audit/checks'
import {
  DEMO_LOCAL_DEV_BASE,
  filterDemoFixtureFlags,
  sortDemoFlags,
} from '@/lib/demo/demo-audit-scope'
import { isDemoDevServerRunning } from '@/lib/demo/audit-demo-fixtures'

export interface DemoFlowAuditResult {
  path: string
  url: string
  flowStatus: string
  flags: DeterministicFlag[]
}

export interface DemoFlowComparison {
  baseline: DemoFlowAuditResult
  fixed: DemoFlowAuditResult
  clearedCheckIds: string[]
  remainingCheckIds: string[]
}

async function auditDemoFlowPath(
  baseUrl: string,
  path: string,
  label: string
): Promise<DemoFlowAuditResult> {
  const url = `${baseUrl.replace(/\/$/, '')}${path}`
  const browser = await getAuditBrowser()
  const scan = await runFlowScanStandalone(browser, `demo-flow-${label}`, url, {
    allowLocalhost: true,
  })
  const flags = sortDemoFlags(filterDemoFixtureFlags(runFlowChecks(scan)))
  return { path, url, flowStatus: scan.status, flags }
}

export async function compareDemoFlow(
  baseUrl = DEMO_LOCAL_DEV_BASE
): Promise<DemoFlowComparison> {
  const running = await isDemoDevServerRunning(baseUrl)
  if (!running) {
    throw new Error(`Dev server not reachable at ${baseUrl}. Start with: npm run dev`)
  }

  const baseline = await auditDemoFlowPath(baseUrl, '/demo', 'original')
  const fixed = await auditDemoFlowPath(baseUrl, '/demo/v1', 'v1')

  const baselineIds = new Set(baseline.flags.map((f) => f.checkId))
  const fixedIds = new Set(fixed.flags.map((f) => f.checkId))
  const clearedCheckIds = [...baselineIds].filter((id) => !fixedIds.has(id)).sort()
  const remainingCheckIds = [...fixedIds].sort()

  return { baseline, fixed, clearedCheckIds, remainingCheckIds }
}
