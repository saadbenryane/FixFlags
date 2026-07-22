#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const violations = []

const codeFiles = execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.js', '*.mjs'], {
  cwd: root,
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean).filter((path) => !path.startsWith('prisma/migrations/'))

for (const path of codeFiles) {
  if (path === 'scripts/product-contract-guard.mjs') continue
  if (!existsSync(join(root, path))) continue
  const source = read(path)
  for (const stale of ['/api/audits', 'ff_check_url', 'ff_monitoring']) {
    if (source.includes(stale)) violations.push(`${path}: stale contract ${stale}`)
  }
}

const home = read('app/(marketing)/page.tsx')
if (home.includes('ReportExamplesSection')) {
  violations.push('app/(marketing)/page.tsx: repeated Flag examples returned')
}

const nav = read('lib/site/nav.ts').split('export const FOOTER_COLUMNS')[0]
if (nav.includes("'/roast'")) violations.push('lib/site/nav.ts: Roast returned to primary navigation')

const sample = read('lib/marketing/live-sample.ts')
if (sample.includes("from '@/lib/db'") || sample.includes('prisma.audit')) {
  violations.push('lib/marketing/live-sample.ts: marketing sample depends on runtime database state')
}

const focused = read('components/audit/FocusedAuditReport.tsx')
const focusedRoute = read('app/report/[id]/page.tsx')
for (const deep of [
  'ReportExplorer',
  'LiveReportExplorer',
  'JourneyReviewTimeline',
  'FlowScanTimeline',
  'ActionTimeline',
  'PreviewCards',
  'LaunchGates',
  'ProductWatchControls',
  'CopyMcpCommand',
]) {
  if (focused.includes(deep)) {
    violations.push(`components/audit/FocusedAuditReport.tsx: deep-review import ${deep}`)
  }
  if (focusedRoute.includes(deep)) {
    violations.push(`app/report/[id]/page.tsx: deep-review import ${deep}`)
  }
}

for (const path of ['app/share/[token]/page.tsx', 'app/api/share/[token]/route.ts']) {
  const source = read(path)
  if (/audit\.(update|updateMany)[\s\S]{0,240}isPublic/.test(source)) {
    violations.push(`${path}: token share mutates Audit.isPublic`)
  }
}

if (violations.length > 0) {
  console.error('Product contract guard failed:\n')
  for (const violation of violations) console.error(`  ${violation}`)
  process.exit(1)
}

console.log('Product contract guard passed.')
