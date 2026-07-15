/**
 * Accuracy probe: run the deterministic scan against real production sites and
 * print every flag, so false positives can be found by eye. HTML-based checks
 * only (no browser); PageSpeed degrades gracefully without a PSI key.
 *
 *   npx tsx scripts/accuracy-probe.ts https://stripe.com https://vercel.com
 */
import { runDeterministicAudit } from '@/lib/audit/deterministic-audit'

const SEV_ORDER = { CRITICAL: 0, IMPORTANT: 1, POLISH: 2 } as const

async function probe(url: string) {
  const t0 = Date.now()
  try {
    const { flags } = await runDeterministicAudit(url)
    const sorted = [...flags].sort(
      (a, b) =>
        (SEV_ORDER[a.severity as keyof typeof SEV_ORDER] ?? 3) -
          (SEV_ORDER[b.severity as keyof typeof SEV_ORDER] ?? 3) ||
        a.checkId.localeCompare(b.checkId)
    )
    console.log(`\n===== ${url}  (${flags.length} flags, ${Date.now() - t0}ms) =====`)
    for (const f of sorted) {
      console.log(`  [${f.severity}] ${f.checkId}`)
      console.log(`      problem : ${f.problem}`)
      if (f.evidence) console.log(`      evidence: ${String(f.evidence).slice(0, 200)}`)
    }
  } catch (err) {
    console.log(`\n===== ${url}  (ERROR) =====`)
    console.log(`  ${(err as Error).message}`)
  }
}

async function main() {
  const urls = process.argv.slice(2)
  if (urls.length === 0) {
    console.error('Usage: tsx scripts/accuracy-probe.ts <url> [url...]')
    process.exit(1)
  }
  for (const url of urls) await probe(url)
}

void main()
