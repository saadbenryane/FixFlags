/**
 * Dump flags + top-3 for existing audits (latest N skipUsageCount audits, or --id <id>).
 * Run: DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/dogfood-dump.ts [--id <auditId> ...] [--out file]
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '@/lib/db'
import {
  rankFlagsByPriority,
  compareFlagsByPriority,
  resolveFixConfidence,
} from '@/lib/audit/priority-flags'
import type { RankableFlag } from '@/lib/audit/flag-types'
import { consolidateFlagsByCheck } from '@/lib/audit/consolidate-flags'

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outPath = outIdx >= 0 ? args[outIdx + 1] : null
const ids: string[] = []
for (let i = 0; i < args.length; i++) if (args[i] === '--id' && args[i + 1]) ids.push(args[i + 1])

async function main() {
  const audits = ids.length
    ? await prisma.audit.findMany({ where: { id: { in: ids } } })
    : await prisma.audit.findMany({
        where: { skipUsageCount: true },
        orderBy: { createdAt: 'desc' },
        take: 3,
      })

  const results = []
  for (const result of audits) {
    const full = await prisma.audit.findUnique({
      where: { id: result.id },
      include: {
        flags: true,
        rubrics: true,
        pages: { select: { url: true, role: true, status: true } },
      },
    })
    if (!full) continue
    const flags: RankableFlag[] = full.flags.map((f) => ({
      id: f.id,
      checkId: f.checkId,
      rubric: f.rubric,
      severity: f.severity,
      impactTag: f.impactTag,
      problem: f.problem,
      evidence: f.evidence,
      whyItMatters: f.whyItMatters,
      fix: f.fix,
      agentPrompt: f.agentPrompt,
      confidence: f.confidence,
      source: f.source,
      pageUrl: f.pageUrl,
      verificationRule: f.verificationRule,
    }))
    const rubricRows = full.rubrics.map((r) => ({ name: r.name, grade: r.grade, score: r.score }))
    const consolidatedFlags = consolidateFlagsByCheck(flags)
    const top3 = rankFlagsByPriority(consolidatedFlags, rubricRows, 3)
    const sorted = [...consolidatedFlags].sort(compareFlagsByPriority)

    console.log(`=== ${full.url} | ${full.status} | score=${full.score} | err=${full.errorMsg ?? '-'} | completeness=${full.reportCompleteness}`)
    console.log(`Rubrics: ${rubricRows.map((x) => `${x.name}=${x.grade ?? '-'}(${x.score ?? '-'})`).join(' ')}`)
    console.log(`Pages: ${full.pages.map((p) => `${p.role}:${p.status}`).join(' ')}`)
    console.log(`Distinct fixes: ${consolidatedFlags.length} (${flags.length} persisted rows)`)
    console.log('All distinct fixes (priority order):')
    for (const f of sorted) {
      console.log(`  [${f.severity}/${f.impactTag ?? '-'}/${f.source}] ${f.checkId ?? 'AI'} conf=${f.confidence}`)
      console.log(`    P: ${f.problem}`)
      console.log(`    E: ${(f.evidence ?? '').slice(0, 160)}`)
    }
    console.log('Top 3:')
    for (const [i, t] of top3.entries()) {
      console.log(`  ${i + 1}. [${t.flag.severity}/${t.flag.impactTag ?? '-'}] ${t.flag.checkId} (${t.rubricName} ${t.rubricGrade ?? '-'}) fixConf=${resolveFixConfidence(t.flag)}`)
    }
    console.log('')
    results.push({ url: full.url, auditId: full.id, status: full.status, score: full.score, errorMsg: full.errorMsg, rubricRows, flags, top3: top3.map((t) => ({ checkId: t.flag.checkId, problem: t.flag.problem })) })
  }
  if (outPath) {
    writeFileSync(outPath, JSON.stringify(results, null, 2))
    console.log(`Wrote ${outPath}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
