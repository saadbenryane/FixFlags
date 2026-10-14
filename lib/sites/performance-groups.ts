import type { SiteFlagSeed } from './coverage'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'

/** Presentation grouping never changes a finding identity or claims a shared cause. */
export function groupPerformanceFindings(flags: readonly SiteFlagSeed[]) {
  const groups = new Map<string, { pageUrl: string | null; device: 'mobile' | 'desktop' | null; flags: SiteFlagSeed[] }>()
  for (const flag of flags) {
    const checkModule = CHECK_REGISTRY[(flag.checkId ?? '').split('::page:')[0]]?.module
    const device = checkModule === 'mobile' ? 'mobile' as const : checkModule === 'performance' ? 'desktop' as const : null
    const key = JSON.stringify([flag.pageUrl, device])
    const group = groups.get(key) ?? { pageUrl: flag.pageUrl, device, flags: [] }
    group.flags.push(flag); groups.set(key, group)
  }
  return [...groups.values()]
}
