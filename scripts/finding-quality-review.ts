/**
 * Weekly finding-quality review.
 *
 *   npm run quality:review -- sample [--count 50] [--days 7] [--out quality-review.csv]
 *   npm run quality:review -- score quality-review.csv
 *
 * `sample` exports customer Flags from recent completed checks on real sites, spread across
 * checks, with an empty label column. Label each row useful, noisy or wrong, then run `score`.
 * The CSV contains page paths and Flag text from customer checks: keep it private and out of git.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { flagPriority } from '@/lib/sites/presentation'
import {
  FIX_FIRST_PRECISION_TARGET, isReviewableHost, parseQualityCsv, sampleAcrossChecks, scoreQualityReview, toQualityCsv, type QualityRow,
} from '@/lib/growth/finding-quality'

function option(args: string[], name: string, fallback: string) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

async function sample(args: string[]) {
  const count = Math.max(1, Number(option(args, 'count', '50')))
  const days = Math.max(1, Number(option(args, 'days', '7')))
  const out = option(args, 'out', 'quality-review.csv')
  const since = new Date(Date.now() - days * 86_400_000)
  const flags = await prisma.flag.findMany({
    where: { createdAt: { gte: since }, audit: { status: 'COMPLETED' } },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: {
      id: true, auditId: true, checkId: true, severity: true, problem: true, pageUrl: true, status: true, confidence: true,
      rubric: true, impactTag: true, attentionPolicy: true, supportingObservations: true, createdAt: true,
      audit: { select: { url: true } },
    },
  })
  const reviewable = flags.filter(flag => {
    try { return isReviewableHost(new URL(flag.audit.url).hostname) && isCustomerFlag(flag) } catch { return false }
  })
  const rows: QualityRow[] = sampleAcrossChecks(reviewable, count).map(flag => {
    const page = flag.pageUrl && URL.canParse(flag.pageUrl) ? new URL(flag.pageUrl).pathname : ''
    return {
      flag_id: flag.id, checked_at: flag.createdAt.toISOString().slice(0, 10), host: new URL(flag.audit.url).hostname, page,
      check_id: flag.checkId ?? '', severity: flag.severity,
      priority_band: flagPriority({ severity: flag.severity, confidence: flag.confidence, checkId: flag.checkId }).band,
      problem: flag.problem, label: '', note: '',
    }
  })
  writeFileSync(out, toQualityCsv(rows))
  console.log(`Wrote ${rows.length} Flags from ${new Set(rows.map(row => row.host)).size} sites to ${out}. Label each row useful, noisy or wrong.`)
}

function score(args: string[]) {
  const file = args[0]
  if (!file) throw new Error('Pass the labeled CSV: npm run quality:review -- score quality-review.csv')
  const result = scoreQualityReview(parseQualityCsv(readFileSync(file, 'utf8')))
  const percent = (value: number | null) => value === null ? 'not enough labels' : `${Math.round(value * 100)}%`
  console.log(`Labeled ${result.labeled}, unlabeled ${result.unlabeled}`)
  console.log(`Precision, all Flags: ${percent(result.precision)}`)
  console.log(`Precision, fix-first Flags: ${percent(result.fixFirst.precision)} of ${result.fixFirst.labeled} (target ${Math.round(FIX_FIRST_PRECISION_TARGET * 100)}%)`)
  if (result.noisiestChecks.length) {
    console.log('Checks to retune first:')
    for (const check of result.noisiestChecks) console.log(`  ${check.checkId}: ${check.noisy} noisy, ${check.wrong} wrong of ${check.labeled}`)
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'sample') await sample(args)
  else if (command === 'score') score(args)
  else throw new Error('Use: quality:review -- sample [--count 50] [--days 7] [--out file] | score <file>')
}

main().then(() => prisma.$disconnect()).catch(async error => {
  console.error(error instanceof Error ? error.message : error)
  await prisma.$disconnect()
  process.exit(1)
})
