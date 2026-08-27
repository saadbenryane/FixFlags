import { config } from 'dotenv'
config({ path: '.env.local' })

import { prisma } from '@/lib/db'
import { runAudit } from '@/lib/audit/runner'
import { parseReviewCoverage } from '@/lib/audit/review-depth'
import { parseAffectedPaths } from '@/lib/audit/flag-identity'

async function main() {
  const url = process.argv[2] ?? 'https://saadbenryane.com'
  const reviewDepth = Number(process.argv[3] ?? 2)
  const audit = await prisma.audit.create({
    data: {
      url,
      isPublic: true,
      auditMode: 'CRITICAL_PATH',
      reviewDepth,
      includeAi: true,
      skipUsageCount: true,
      journeyReviewIncluded: false,
    },
    select: { id: true },
  })
  console.log(JSON.stringify({ started: audit.id, url, reviewDepth }))
  await runAudit(audit.id)
  const done = await prisma.audit.findUnique({
    where: { id: audit.id },
    select: {
      id: true,
      status: true,
      reportCompleteness: true,
      reviewCoverage: true,
      reviewDepth: true,
      score: true,
      flags: { select: { checkId: true, pageUrl: true, affectedPaths: true, problem: true } },
      pages: { select: { url: true, completeness: true } },
    },
  })
  if (!done) throw new Error('audit missing after run')
  const coverage = parseReviewCoverage(done.reviewCoverage)
  const occurrenceCounts = done.flags.map((flag) => parseAffectedPaths(flag.affectedPaths).length)
  console.log(
    JSON.stringify(
      {
        id: done.id,
        status: done.status,
        reportCompleteness: done.reportCompleteness,
        reviewDepth: done.reviewDepth,
        score: done.score,
        coverage,
        pageCount: done.pages.length,
        flagCount: done.flags.length,
        pages: done.pages,
        maxAffectedPaths: Math.max(0, ...occurrenceCounts),
        reportUrl: `http://localhost:3000/report/${done.id}`,
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
