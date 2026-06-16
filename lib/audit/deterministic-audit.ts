import { runAllChecks, type DeterministicFlag } from './checks'
import { runFlowChecks } from './checks/flow'
import { fetchAndParseMetadata } from './metadata'
import { fetchPageSpeedData } from './pagespeed'
import { getAuditBrowser } from './screenshot'
import { runFlowScanStandalone, type FlowScanResult } from './flow/run-flow-scan'

export interface DeterministicAuditResult {
  flags: DeterministicFlag[]
  flowResult: FlowScanResult | null
}

export async function runDeterministicAudit(
  url: string,
  options?: {
    includeFlow?: boolean
    auditId?: string
    consoleErrors?: Array<{ type: string; text: string }>
  }
): Promise<DeterministicAuditResult> {
  const metadata = await fetchAndParseMetadata(url)
  const pagespeed = await fetchPageSpeedData(url)

  const { flags: detFlags } = await runAllChecks(
    url,
    metadata,
    pagespeed.desktop,
    pagespeed.mobile,
    options?.consoleErrors ?? []
  )
  let flags = detFlags

  let flowResult: FlowScanResult | null = null
  if (options?.includeFlow && options.auditId) {
    const browser = await getAuditBrowser()
    flowResult = await runFlowScanStandalone(browser, options.auditId, url)
    flags = flags.concat(runFlowChecks(flowResult))
  }

  return { flags, flowResult }
}
