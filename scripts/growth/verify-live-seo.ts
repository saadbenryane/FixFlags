#!/usr/bin/env -S npx tsx
import { inspectPublicDiscovery } from '@/lib/growth/public-discovery'
import { INDEXABLE_ROUTES } from '@/lib/marketing/seo-routes'

async function main() {
  const report = await inspectPublicDiscovery({
    origin: process.env.SEO_VERIFY_ORIGIN,
    // Public research is deliberately absent until an eligible reviewed release exists.
    requiredPaths: INDEXABLE_ROUTES.filter(route => route.path !== '/issues').map(route => route.path),
  })
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else {
    for (const check of report.checks.filter(check => check.status !== 'pass')) {
      console.log(`${check.status} ${check.path} ${check.name}`)
    }
    console.log(`${report.htmlPagesChecked} HTML pages checked; ${report.advertisedUrls} sitemap URLs; ${report.checks.filter(check => check.status === 'pass').length}/${report.checks.length} technical checks passed.`)
    for (const limitation of report.limitations) console.log(limitation)
  }
  if (report.checks.some(check => check.status !== 'pass')) process.exitCode = 1
}

main().catch(() => {
  console.error('[verify-live-seo] Inspection unavailable. Use the public FixFlags origin or a loopback fixture. No response body or credential was printed.')
  process.exitCode = 1
})
