#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const violations = []
const legacyContractFixtureFiles = new Set([
  'scripts/completeness-audit.mjs',
  'scripts/completeness-audit.test.mjs',
  'scripts/product-contract-guard.test.mjs',
])
const legacyFinishPlanFiles = new Set([
  'lib/audit/finish-plan.ts',
  'lib/audit/load-finish-plan-flags.ts',
  'lib/audit/task-contracts.ts',
])

const codeFiles = execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.js', '*.mjs'], {
  cwd: root,
  encoding: 'utf8',
}).trim().split('\n').filter(Boolean).filter((path) => !path.startsWith('prisma/migrations/'))

for (const path of codeFiles) {
  if (path === 'scripts/product-contract-guard.mjs' || legacyContractFixtureFiles.has(path)) continue
  if (!existsSync(join(root, path))) continue
  const source = read(path)
  for (const stale of ['/api/audits', 'ff_check_url', 'ff_monitoring']) {
    if (source.includes(stale)) violations.push(`${path}: stale contract ${stale}`)
  }
  if (
    source.includes('buildFinishPlan') &&
    !path.includes('__tests__') &&
    !legacyFinishPlanFiles.has(path)
  ) {
    violations.push(`${path}: new product surface depends on legacy buildFinishPlan`)
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

const reportRoute = read('app/report/[id]/page.tsx')
const completedReport = read('app/report/[id]/CompletedReportView.tsx')
const auditReport = read('components/audit/AuditReport.tsx')
const detailsRoute = read('app/report/[id]/details/page.tsx')
if (!reportRoute.includes('CompletedReportView')) {
  violations.push('app/report/[id]/page.tsx: canonical completed report view missing')
}
if (!completedReport.includes('AuditReport')) {
  violations.push('app/report/[id]/CompletedReportView.tsx: canonical AuditReport missing')
}
if (!auditReport.includes('LiveReportExplorer')) {
  violations.push('components/audit/AuditReport.tsx: complete Flag explorer missing')
}
if (!detailsRoute.includes('redirect(`/report/${id}`)')) {
  violations.push('app/report/[id]/details/page.tsx: legacy details route must redirect')
}

const quality = read('QUALITY.md')
for (const stale of ['three-item Finish Plan', 'Focused versus detailed report contract', 'Back to Finish Plan']) {
  if (quality.includes(stale)) violations.push(`QUALITY.md: stale split-report contract "${stale}"`)
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
