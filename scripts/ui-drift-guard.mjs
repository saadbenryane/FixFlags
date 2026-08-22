#!/usr/bin/env node
/**
 * Flags design-system drift in app and product components:
 * - font-display outside marketing/pricing surfaces
 * - rounded-xl / rounded-lg on panel-like shells (border + bg/padding combos)
 * - arbitrary micro font sizes (use text-2xs/text-3xs or .section-label/.meta-label)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
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

    if (/fetch\(['"]\/api\/stripe\/(?:checkout|waitlist)['"]/.test(content)) {
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

for (const removedPath of [
  'components/report/ProductSpineWorkspace.tsx',
  'components/report/LivingReviewEmulation.tsx',
  'components/report/ScoreRingGauge.tsx',
  'components/report/ScanTimeline.tsx',
  'lib/report/observation-snapshot.ts',
  'app/api/reports/[id]/observation/route.ts',
]) {
  if (existsSync(join(ROOT, removedPath))) {
    violations.push(`${removedPath}: obsolete parallel Review architecture returned`)
  }
}

if (!reportShell.includes('<ReportPane')) {
  violations.push('components/audit/AuditReport.tsx: completed reports must use ReportPane')
}
if (reportShell.includes('canUseTimeline')) {
  violations.push('components/audit/AuditReport.tsx: Timeline permission is still conflated')
}

const outcomeHeader = readFileSync(join(ROOT, 'components/report/ReportOutcomeBar.tsx'), 'utf8')
for (const [pattern, reason] of [
  [/ScoreRingGauge/, 'circular score gauge returned'],
  [/nextStepHint|Start with the top Flag/, 'duplicated next-step instruction returned'],
  [/criticalCount|showCriticalFlags/, 'duplicated Critical shortcut returned'],
]) {
  if (pattern.test(outcomeHeader)) {
    violations.push(`components/report/ReportOutcomeBar.tsx: ${reason}`)
  }
}

const homepagePreview = readFileSync(
  join(ROOT, 'components/marketing/landing/HomepageReportPreview.tsx'),
  'utf8'
)
if (!homepagePreview.includes('ReportWorkspaceSplitShell')) {
  violations.push('components/marketing/landing/HomepageReportPreview.tsx: homepage forked the Review shell')
}

const sampleRoute = readFileSync(join(ROOT, 'app/(marketing)/samples/page.tsx'), 'utf8')
if (!sampleRoute.includes('UnknownCuratedObservationError') || !sampleRoute.includes('notFound()')) {
  violations.push('app/(marketing)/samples/page.tsx: unknown curated observations must fail closed')
}

const workspaceAdapters = readFileSync(join(ROOT, 'lib/report/workspace-adapters.ts'), 'utf8')
for (const required of [
  'canReplayTimeline: true',
  'canChat: false',
  'canUseCanvas: false',
  "promptAccess: 'demonstrated'",
]) {
  if (!workspaceAdapters.includes(required)) {
    violations.push(`lib/report/workspace-adapters.ts: curated sample capability drift (${required})`)
  }
}

const sampleDisplay = readFileSync(join(ROOT, 'lib/marketing/sample-report-display.ts'), 'utf8')
if (/audit\.id\s*===\s*['"]curated-sample/.test(sampleDisplay)) {
  violations.push('lib/marketing/sample-report-display.ts: evidence anchors are coupled to one observation')
}

const captureScript = readFileSync(join(ROOT, 'scripts/capture-sample-screenshots.ts'), 'utf8')
if (
  !/const publicDirectory = `\/samples\/observations\/\$\{definition\.id\}`/.test(captureScript) ||
  !captureScript.includes('.webp(')
) {
  violations.push('scripts/capture-sample-screenshots.ts: versioned real-WebP sample generation drifted')
}

// The Report pane measures the pane, never the viewport: no 100vh caps, no
// page-header sticky offsets, no card shell fighting the pane.
const explorer = readFileSync(join(ROOT, 'components/report/ReportExplorer.tsx'), 'utf8')
for (const [pattern, reason] of [
  [/100vh/, 'viewport height inside the Report pane (size against the pane)'],
  [/sticky[^"']*--header-offset/, 'page-header sticky offset inside the Report pane'],
  [/overflow-clip/, 'overflow-clip shell breaks pane scrolling'],
  [/\blg:/, 'viewport breakpoint inside the Report pane (use @[..]/pane container queries)'],
]) {
  if (pattern.test(explorer)) {
    violations.push(`components/report/ReportExplorer.tsx: ${reason}`)
  }
}

if (violations.length) {
  console.error('UI drift guard failed:\n')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log('UI drift guard passed.')
