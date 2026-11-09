#!/usr/bin/env -S npx tsx
import { inspectPublicDiscovery, inspectPublicResearchWithdrawal } from '@/lib/growth/public-discovery'
import { INDEXABLE_ROUTES } from '@/lib/marketing/seo-routes'
import { WEBSITE_GUIDE_SLUGS } from '@/lib/analytics/guide-entry'
import { parseArgs } from 'node:util'

async function main() {
  const { values } = parseArgs({ options: { json: { type: 'boolean' }, 'expect-no-research': { type: 'boolean' },
    'withdrawn-issue': { type: 'string', multiple: true } } })
  if (values['withdrawn-issue']) {
    if (values['expect-no-research']) throw new Error('Choose one research verification mode')
    const report = await inspectPublicResearchWithdrawal({ origin: process.env.SEO_VERIFY_ORIGIN, issueIds: values['withdrawn-issue'] })
    if (values.json) console.log(JSON.stringify(report, null, 2))
    else {
      for (const check of report.checks) console.log(`${check.status} ${check.path} ${check.name}`)
      for (const limitation of report.limitations) console.log(limitation)
    }
    if (report.checks.some(check => check.status !== 'pass')) process.exitCode = 1
    return
  }
  const report = await inspectPublicDiscovery({
    origin: process.env.SEO_VERIFY_ORIGIN,
    // Public research is deliberately absent until an eligible reviewed release exists.
    requiredPaths: INDEXABLE_ROUTES.filter(route => route.path !== '/issues').map(route => route.path),
    guidePaths: WEBSITE_GUIDE_SLUGS.map(slug => `/guides/${slug}`),
    expectNoResearch: values['expect-no-research'],
  })
  if (values.json) console.log(JSON.stringify(report, null, 2))
  else {
    for (const check of report.checks.filter(check => check.status !== 'pass')) {
      console.log(`${check.status} ${check.path} ${check.name}`)
    }
    console.log(`${report.htmlPagesChecked} HTML pages checked; ${report.advertisedUrls} sitemap URLs; ${report.checks.filter(check => check.status === 'pass').length}/${report.checks.length} technical checks passed.`)
    const streamed = report.checks.filter(check => check.delivery === 'streamed').length
    if (streamed) console.log(`${streamed} required guide links arrived in streamed HTML segments.`)
    for (const limitation of report.limitations) console.log(limitation)
  }
  if (report.checks.some(check => check.status !== 'pass')) process.exitCode = 1
}

main().catch(() => {
  console.error('[verify-live-seo] Inspection unavailable. Use the public FixFlags origin or a loopback fixture. No response body or credential was printed.')
  process.exitCode = 1
})
