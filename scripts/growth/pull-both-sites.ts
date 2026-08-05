#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * Unified GA4 + GSC report for both saadbenryane.com and fixflags.com
 * Run: npm run growth:pull-both [--days=28]
 */

import { runGaPull } from "@/lib/growth/ga-pull"
import { runGscPull } from "@/lib/growth/gsc-pull"

const daysArg = process.argv.find((a) => a.startsWith("--days="))
const days = daysArg ? Number.parseInt(daysArg.split("=")[1], 10) : 28

const SITES = [
  {
    name: "saadbenryane.com",
    ga4PropertyId: "485200760",
    gscProperty: "sc-domain:saadbenryane.com",
    credPath: "/Users/saadbenryane/Code/famous-sunbeam-454800-c4-a843f3034945.json",
  },
  {
    name: "fixflags.com",
    ga4PropertyId: "541892062",
    gscProperty: "sc-domain:fixflags.com",
    credPath: "/Users/saadbenryane/code/focus-heuristic-499814-b7-15922c9f53c2.json",
  },
] as const

async function pullSite(site: (typeof SITES)[number]) {
  // Temporarily override env for this site
  const origGa4 = process.env.GA4_PROPERTY_ID
  const origGsc = process.env.GSC_PROPERTY
  const origCred = process.env.GSC_SERVICE_ACCOUNT_KEY

  process.env.GA4_PROPERTY_ID = site.ga4PropertyId
  process.env.GSC_PROPERTY = site.gscProperty
  process.env.GSC_SERVICE_ACCOUNT_KEY = site.credPath

  try {
    const [ga, gsc] = await Promise.all([
      runGaPull().catch((e) => ({ error: `GA: ${e.message}` })),
      runGscPull().catch((e) => ({ error: `GSC: ${e.message}` })),
    ])
    return { site: site.name, ga, gsc }
  } finally {
    // Restore original env
    if (origGa4) process.env.GA4_PROPERTY_ID = origGa4
    if (origGsc) process.env.GSC_PROPERTY = origGsc
    if (origCred) process.env.GSC_SERVICE_ACCOUNT_KEY = origCred
  }
}

function formatTelegramReport(results: Awaited<ReturnType<typeof pullSite>>[], days: number) {
  const lines = [
    `📊 *Daily Analytics Report*`,
    `📅 ${new Date().toLocaleDateString()} | ${days}-day window`,
    ``,
  ]

  for (const r of results) {
    lines.push(`*${r.site}*`)

    // GA Summary
    if (r.ga && "summary" in r.ga) {
      const s = r.ga.summary
      lines.push(
        `  📈 GA: ${s.totalUsers?.toLocaleString()} users | ${s.sessions?.toLocaleString()} sessions | ${s.screenPageViews?.toLocaleString()} views | ${((Number(s.engagementRate) || 0) * 100).toFixed(1)}% engagement`
      )
      if (r.ga.pages?.pages?.length) {
        const top = r.ga.pages.pages[0]
        lines.push(`  🏆 Top page: ${top.pagePath || top.page} (${top.screenPageViews?.toLocaleString()} views)`)
      }
    } else if (r.ga && "error" in r.ga) {
      lines.push(`  ❌ GA: ${r.ga.error}`)
    }

    // GSC Summary
    if (r.gsc && "summary" in r.gsc) {
      const s = r.gsc.summary
      lines.push(
        `  🔍 GSC: ${s.totalClicks?.toLocaleString()} clicks | ${s.totalImpressions?.toLocaleString()} impressions | ${(s.avgCtr * 100).toFixed(2)}% CTR | pos ${s.avgPosition.toFixed(1)}`
      )
      if (s.brandedClicks !== undefined) {
        lines.push(`  🏷️ Branded: ${s.brandedClicks} clicks (${(s.brandedShare * 100).toFixed(1)}%)`)
      }
      if (r.gsc.queries?.queries?.length) {
        const top = r.gsc.queries.queries[0]
        lines.push(`  🔑 Top query: "${top.query}" (${top.clicks} clicks)`)
      }
    } else if (r.gsc && "error" in r.gsc) {
      lines.push(`  ❌ GSC: ${r.gsc.error}`)
    }

    lines.push(``)
  }

  lines.push(`_Generated ${new Date().toLocaleTimeString()}_`)
  return lines.join("\n")
}

async function main() {
  console.log(`🔄 Fetching analytics for ${SITES.length} sites (${days}-day window)...\n`)

  const results = await Promise.all(SITES.map(pullSite))

  const report = formatTelegramReport(results, days)
  console.log(report)

  // Also output JSON for programmatic use
  console.log("\n--- JSON ---")
  console.log(JSON.stringify(results, null, 2))
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})