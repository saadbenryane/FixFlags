import { compareDemoFixtures } from '@/lib/demo/audit-demo-fixtures'

/** @deprecated Use compareDemoFixtures({ mode: 'offline' }) */
export async function auditDemoFixturesOffline(origin = 'https://fixflags.com') {
  void origin
  const comparison = await compareDemoFixtures({ mode: 'offline' })
  return {
    original: comparison.baseline.flags,
    v1: comparison.fixed.flags,
  }
}
