#!/usr/bin/env node
/**
 * Flags design-system drift in app and product components:
 * - font-display outside marketing/pricing surfaces
 * - rounded-xl / rounded-lg on panel-like shells (border + bg/padding combos)
 * - arbitrary micro font sizes (use text-2xs/text-3xs or .section-label/.meta-label)
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components']
const SKIP = new Set(['node_modules', '.next', 'dist', 'marketing'])

const FONT_DISPLAY_ALLOW = [
  /^app\/\(marketing\)\//,
  /^app\/opengraph-image/,
  /^components\/marketing\//,
  /^components\/pricing\//,
  /^components\/brand\//,
  /^components\/help\//,
]

const PANEL_RE =
  /className=(?:"[^"]*rounded-(xl|lg)[^"]*(?:border|bg-|shadow|\sp-\d)[^"]*"|'[^']*rounded-(xl|lg)[^']*(?:border|bg-|shadow|\sp-\d)[^']*')/

const CN_PANEL_RE =
  /cn\([^)]*['"`][^'"`]*rounded-(xl|lg)[^'"`]*(?:\sborder|\sbg-)/

const MICRO_TEXT_RE = /text-\[1[012]px\]/

function hasPanelDrift(content) {
  if (PANEL_RE.test(content)) return true
  return CN_PANEL_RE.test(content)
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, files)
    else if (/\.tsx$/.test(name)) files.push(p)
  }
  return files
}

const violations = []

for (const dir of SCAN_DIRS) {
  const base = join(ROOT, dir)
  for (const file of walk(base)) {
    const rel = relative(ROOT, file)
    const content = readFileSync(file, 'utf8')

    if (content.includes('font-display') && !FONT_DISPLAY_ALLOW.some((re) => re.test(rel))) {
      violations.push(`${rel}: font-display outside marketing/pricing surfaces`)
    }

    if (hasPanelDrift(content)) {
      violations.push(`${rel}: rounded-xl/lg panel shell (use Card/Surface + rounded-card)`)
    }

    if (MICRO_TEXT_RE.test(content)) {
      violations.push(`${rel}: arbitrary micro font size (use text-2xs/text-3xs or .section-label/.meta-label)`)
    }

    if (/fetch\(['"]\/api\/stripe\/(?:checkout|beta-interest)['"]/.test(content)) {
      violations.push(
        `${rel}: duplicate Stripe action request (use lib/billing/client-checkout.ts)`
      )
    }

    if (
      /(?:^|\/)error\.tsx$/.test(rel) &&
      rel !== 'app/global-error.tsx' &&
      !content.includes('RouteErrorPage') &&
      !content.includes('export { default }')
    ) {
      violations.push(`${rel}: route error boundary must use RouteErrorPage`)
    }
  }
}

const reportShell = readFileSync(join(ROOT, 'components/audit/AuditReport.tsx'), 'utf8')
const reportExplorerCount = (reportShell.match(/<LiveReportExplorer\b/g) ?? []).length
if (reportExplorerCount !== 1) {
  violations.push(
    `components/audit/AuditReport.tsx: expected exactly one LiveReportExplorer, found ${reportExplorerCount}`
  )
}

for (const removed of ['RubricsPanel', 'ReportMiniNav', 'CompletenessHeader']) {
  if (reportShell.includes(removed)) {
    violations.push(`components/audit/AuditReport.tsx: removed report chrome ${removed} returned`)
  }
}

const stickyToolbar = readFileSync(join(ROOT, 'components/audit/ReportStickyToolbar.tsx'), 'utf8')
if (/['"]Overview['"]/.test(stickyToolbar)) {
  violations.push('components/audit/ReportStickyToolbar.tsx: Overview is not a report destination')
}

if (violations.length) {
  console.error('UI drift guard failed:\n')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log('UI drift guard passed.')
