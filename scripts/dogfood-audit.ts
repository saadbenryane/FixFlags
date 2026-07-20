/**
 * Dogfood harness: run the full audit pipeline on real URLs and print a
 * quality report (flags, prioritization signals, top-3, dupe/FP analysis).
 *
 * Run: DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/dogfood-audit.ts [--include-ai] [--out /tmp/dogfood.json] [url ...]
 */
import { writeFileSync } from 'node:fs'
import { prisma } from '@/lib/db'
import { runAudit } from '@/lib/audit/runner'
import { closeBrowser } from '@/lib/audit/screenshot'
import {
  rankFlagsByPriority,
  compareFlagsByPriority,
  resolveFixConfidence,
} from '@/lib/audit/priority-flags'
import type { RankableFlag } from '@/lib/audit/flag-types'

const args = process.argv.slice(2)
const includeAi = args.includes('--include-ai')
const outIdx = args.indexOf('--out')
const outPath = outIdx >= 0 ? args[outIdx + 1] : null
const urls = args.filter((a, i) => !a.startsWith('--') && (outIdx < 0 || i !== outIdx + 1))

const TARGETS = urls.length > 0 ? urls : [
  'https://fixflags.com',
  'https://fixflags.com/demo',
  'https://saadbenryane.com',
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function jaccard(a: string, b: string): number {
  const sa = new Set(normalize(a).split(' '))
  const sb = new Set(normalize(b).split(' '))
  const inter = [...sa].filter((w) => sb.has(w)).length
  return inter / Math.max(1, sa.size + sb.size - inter)
}

async function auditUrl(url: string) {
  const audit = await prisma.audit.create({
    data: { url, status: 'QUEUED', includeAi, skipUsageCount: true, isPublic: false },
  })
  const start = Date.now()
  try {
    await runAudit(audit.id)
  } catch (err) {
    console.error(`  PIPELINE ERROR: ${String(err)}`)
  }
  const elapsedMs = Date.now() - start

  const result = await prisma.audit.findUnique({
    where: { id: audit.id },
    include: {
      flags: true,
      rubrics: true,
      pages: { select: { url: true, role: true, status: true } },
      journeyReviews: { select: { journeyType: true, status: true, goalAchieved: true } },
    },
  })
  if (!result) throw new Error('audit vanished')

  const flags: RankableFlag[] = result.flags.map((f) => ({
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

  const rubricRows = result.rubrics.map((r) => ({ name: r.name, grade: r.grade, score: r.score }))
  const top3 = rankFlagsByPriority(flags, rubricRows, 3)
  const sorted = [...flags].sort(compareFlagsByPriority)

  // --- Quality analysis ---
  const checkIdCounts = new Map<string, number>()
  for (const f of flags) {
    if (f.checkId) checkIdCounts.set(f.checkId, (checkIdCounts.get(f.checkId) ?? 0) + 1)
  }
  const duplicateCheckIds = [...checkIdCounts.entries()].filter(([, n]) => n > 1)

  const nearDupes: Array<{ a: string; b: string; sim: number }> = []
  for (let i = 0; i < flags.length; i++) {
    for (let j = i + 1; j < flags.length; j++) {
      const sim = jaccard(flags[i].problem, flags[j].problem)
      if (sim >= 0.6) {
        nearDupes.push({
          a: `${flags[i].checkId ?? 'ai'} :: ${flags[i].problem.slice(0, 70)}`,
          b: `${flags[j].checkId ?? 'ai'} :: ${flags[j].problem.slice(0, 70)}`,
          sim: Math.round(sim * 100) / 100,
        })
      }
    }
  }

  const weakEvidence = flags.filter(
    (f) => !f.evidence?.trim() || f.evidence.trim() === f.problem.trim()
  )
  const lowConfidence = flags.filter((f) => typeof f.confidence === 'number' && f.confidence < 0.5)

  return {
    url,
    auditId: audit.id,
    status: result.status,
    score: result.score,
    verdict: result.verdict,
    errorMsg: result.errorMsg,
    failureCode: result.failureCode,
    triageAt: result.triageAt,
    reportCompleteness: result.reportCompleteness,
    pages: result.pages,
    journeyReviews: result.journeyReviews,
    rubricRows,
    flagCount: flags.length,
    flags,
    sortedCheckIds: sorted.map((f) => f.checkId ?? `ai:${f.problem.slice(0, 40)}`),
    top3: top3.map(({ flag, rubricName, rubricGrade }) => ({
      checkId: flag.checkId,
      rubric: rubricName,
      rubricGrade,
      severity: flag.severity,
      impactTag: flag.impactTag,
      confidence: flag.confidence,
      fixConfidence: resolveFixConfidence(flag),
      problem: flag.problem,
      evidence: flag.evidence,
      fix: flag.fix,
      hasAgentPrompt: !!flag.agentPrompt,
      source: flag.source,
      pageUrl: flag.pageUrl,
    })),
    analysis: { duplicateCheckIds, nearDupes, weakEvidence: weakEvidence.map((f) => f.checkId), lowConfidence: lowConfidence.map((f) => `${f.checkId} (${f.confidence})`) },
    elapsedMs,
  }
}

async function main() {
  console.log(`Dogfood audit (includeAi=${includeAi})\nTargets: ${TARGETS.join(', ')}\n`)
  const results = []
  for (const url of TARGETS) {
    console.log(`Auditing ${url} ...`)
    const r = await auditUrl(url)
    results.push(r)
    console.log(`  -> ${r.status} score=${r.score ?? '-'} flags=${r.flagCount} triage=${r.triageAt ? 'ok' : 'none'} ${Math.round(r.elapsedMs / 1000)}s`)
    if (r.errorMsg) console.log(`  ERROR: ${r.errorMsg}`)
    console.log(`  Rubrics: ${r.rubricRows.map((x) => `${x.name}=${x.grade ?? '-'}(${x.score ?? '-'})`).join(' ')}`)
    console.log(`  Pages: ${r.pages.map((p) => `${p.role}:${p.status}`).join(' ')}`)
    console.log('  Top 3:')
    for (const [i, t] of r.top3.entries()) {
      console.log(`    ${i + 1}. [${t.severity}/${t.impactTag ?? '-'}] ${t.checkId} (${t.rubric} ${t.rubricGrade ?? '-'}) conf=${t.confidence}`)
      console.log(`       ${t.problem}`)
      console.log(`       evidence: ${(t.evidence ?? '').slice(0, 140)}`)
    }
    if (r.analysis.duplicateCheckIds.length) console.log(`  !! duplicate checkIds: ${JSON.stringify(r.analysis.duplicateCheckIds)}`)
    if (r.analysis.nearDupes.length) {
      console.log(`  !! near-duplicate problems:`)
      for (const d of r.analysis.nearDupes) console.log(`     ${d.sim} | ${d.a}  <=>  ${d.b}`)
    }
    if (r.analysis.weakEvidence.length) console.log(`  !! weak/missing evidence: ${r.analysis.weakEvidence.join(', ')}`)
    if (r.analysis.lowConfidence.length) console.log(`  !! low confidence: ${r.analysis.lowConfidence.join(', ')}`)
    console.log('')
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
  .finally(async () => {
    await closeBrowser().catch(() => {})
    await prisma.$disconnect()
  })
