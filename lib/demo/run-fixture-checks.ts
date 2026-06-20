import { runAllChecks, type DeterministicFlag } from '@/lib/audit/checks'
import type { PageMetadata } from '@/lib/audit/metadata'
import { filterDemoFixtureFlags } from '@/lib/demo/demo-audit-scope'

/** Run deterministic checks against parsed page metadata; return in-scope fixture flags only. */
export async function runFixtureChecks(
  pageUrl: string,
  metadata: PageMetadata
): Promise<DeterministicFlag[]> {
  const { flags } = await runAllChecks(pageUrl, metadata, null, null, [])
  return filterDemoFixtureFlags(flags)
}
