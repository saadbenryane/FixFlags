/**
 * Batch audit test: run pipeline on multiple URLs and print quality summary.
 * Run: DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/batch-audit-test.ts
 */
import { prisma } from '@/lib/db'
import { runAudit } from '@/lib/audit/runner'
import { closeBrowser } from '@/lib/audit/screenshot'

const TEST_URLS = [
  'https://fixflags.com/demo',
  'https://stripe.com',
  'https://vercel.com',
]

async function auditUrl(url: string) {
  const audit = await prisma.audit.create({
    data: { url, status: 'QUEUED', includeAi: false, skipUsageCount: true, isPublic: false },
  })

  const start = Date.now()
  try {
    await runAudit(audit.id)
  } catch (err) {
    return { url, auditId: audit.id, error: String(err), elapsedMs: Date.now() - start }
  }

  const result = await prisma.audit.findUnique({
    where: { id: audit.id },
    select: {
      status: true,
      score: true,
      verdict: true,
      errorMsg: true,
      reportCompleteness: true,
      flowData: true,
    },
  })

  const flags = await prisma.flag.findMany({
    where: { auditId: audit.id },
    select: { checkId: true, rubric: true, severity: true, problem: true },
    orderBy: { severity: 'asc' },
  })

  const rubricCounts = flags.reduce(
    (acc, f) => {
      acc[f.rubric] = (acc[f.rubric] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const severityCounts = flags.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return {
    url,
    auditId: audit.id,
    status: result?.status,
    score: result?.score,
    verdict: result?.verdict,
    reportCompleteness: result?.reportCompleteness,
    flowStatus: (result?.flowData as { status?: string } | null)?.status ?? null,
    flagCount: flags.length,
    rubricCounts,
    severityCounts,
    topFlags: flags.slice(0, 5).map((f) => `[${f.severity}] ${f.checkId}: ${f.problem?.slice(0, 80)}`),
    elapsedMs: Date.now() - start,
    error: result?.errorMsg,
  }
}

async function main() {
  console.log('Batch audit test\n')
  const results = []

  for (const url of TEST_URLS) {
    console.log(`Auditing ${url}...`)
    const result = await auditUrl(url)
    results.push(result)
    console.log(
      `  → ${result.status ?? 'error'} | score=${result.score ?? '—'} | flags=${result.flagCount ?? 0} | ${Math.round((result.elapsedMs ?? 0) / 1000)}s`
    )
    if (result.error) console.log(`  ERROR: ${result.error}`)
  }

  console.log('\n--- Summary ---\n')
  console.log(JSON.stringify(results, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await closeBrowser().catch(() => {})
    await prisma.$disconnect()
  })
