/**
 * Refresh marketing sample: audit demo fixture, mark public, capture WebPs, resolve pin anchors.
 *
 * Prerequisites: Postgres + Redis running, `.env.local` with API keys, `npm run dev:all` optional
 * (this script runs the audit pipeline inline — no worker required).
 *
 * Run:
 *   DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/refresh-marketing-sample.ts
 */
import { execSync } from 'node:child_process'
import { prisma } from '@/lib/db'
import { runAudit } from '@/lib/audit/runner'
import { closeBrowser } from '@/lib/audit/screenshot'
import { DEFAULT_SAMPLE_AUDIT_URL } from '@/lib/marketing/display-meta'
import {
  resolveEvidenceAnchors,
  writeEvidenceAnchorsFile,
  readEvidenceAnchorsFile,
} from '@/lib/marketing/resolve-evidence-anchors'

const SAMPLE_URL = process.env.SAMPLE_AUDIT_URL ?? DEFAULT_SAMPLE_AUDIT_URL

async function main() {
  const url = new URL(SAMPLE_URL).toString()
  console.log(`\n1. Creating audit for ${url}...`)

  const includeAi = process.env.SAMPLE_INCLUDE_AI !== 'false'

  const audit = await prisma.audit.create({
    data: {
      url,
      status: 'QUEUED',
      includeAi,
      skipUsageCount: true,
      isPublic: false,
    },
  })

  console.log(`   auditId=${audit.id}`)
  console.log('\n2. Running audit pipeline (may take ~60–120s)...')

  try {
    await runAudit(audit.id)
  } finally {
    await closeBrowser().catch(() => {})
  }

  const completed = await prisma.audit.findUnique({
    where: { id: audit.id },
    select: { status: true, errorMsg: true },
  })
  if (completed?.status !== 'COMPLETED') {
    throw new Error(completed?.errorMsg ?? `Audit ended with status ${completed?.status}`)
  }

  console.log('\n3. Marking audit public for live sample...')
  await prisma.audit.update({
    where: { id: audit.id },
    data: { isPublic: true },
  })

  console.log('\n4. Capturing marketing WebP screenshots...')
  execSync('npx tsx scripts/capture-sample-screenshots.ts', {
    stdio: 'inherit',
    env: { ...process.env, SAMPLE_CAPTURE_URL: url },
  })

  console.log('\n5. Resolving evidence pin anchors...')
  const flags = await prisma.flag.findMany({
    where: { auditId: audit.id },
    select: { id: true, checkId: true },
  })

  const checkIds = [
    ...new Set(flags.map((f) => f.checkId ?? f.id).filter(Boolean)),
  ]

  const fresh = await resolveEvidenceAnchors({ url, checkIds: [...new Set(checkIds)] })
  const existing = await readEvidenceAnchorsFile()
  const merged = { ...existing, ...fresh }
  await writeEvidenceAnchorsFile(merged)

  console.log(`\nDone. Live sample audit: ${audit.id}`)
  console.log(`   Anchors: ${Object.keys(merged).length} checkIds`)
  console.log('   Verify: /, /#sample-report, /samples')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => closeBrowser().catch(() => {}))
