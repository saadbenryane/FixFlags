import { AUDIT_CAPABILITIES, capabilitySummary } from '@/lib/audit/capability-matrix'
import { CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import { ADVERTISED_COVERAGE_REGISTRY } from '@/lib/audit/advertised-coverage'

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length)
}

function main() {
  const summary = capabilitySummary()

  console.log('FixFlags audit capability matrix\n')
  console.log(`Deterministic checks registered: ${CHECK_ID_COUNT}`)
  console.log(`Homepage responsibilities mapped: ${ADVERTISED_COVERAGE_REGISTRY.size} (registration is not execution proof)`)
  for (const item of ADVERTISED_COVERAGE_REGISTRY.values()) if (item.extent === 'partial')
    console.log(`  Incomplete: ${item.id}. ${item.limitation}`)
  console.log(
    `Capabilities: ${summary.totalCapabilities} (${summary.byImplementation.implemented} implemented, ${summary.byImplementation.partial} partial, ${summary.byImplementation.planned} planned)\n`
  )

  console.log('Implementation inventory only. Runtime eligibility, consent, release policy and actual execution evidence remain separate.\n')
  console.log('By tool:')
  for (const [tool, count] of [...summary.byTool.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${pad(tool, 18)} ${count}`)
  }

  if (summary.unmapped.length) {
    console.log(`\nChecks not yet mapped to a capability: ${summary.unmapped.join(', ')}`)
  }

  console.log('\n--- Capabilities ---\n')
  const col = { status: 12, tool: 18, dim: 12, category: 16 }
  console.log(
    `${pad('IMPLEMENTATION', col.status)} ${pad('TOOL', col.tool)} ${pad('DIMENSION', col.dim)} ${pad('CATEGORY', col.category)} LABEL`
  )
  console.log('-'.repeat(90))

  for (const cap of AUDIT_CAPABILITIES) {
    const checks =
      cap.checkIds.length > 0 ? ` [${cap.checkIds.join(', ')}]` : cap.notes ? ` (${cap.notes})` : ''
    console.log(
      `${pad(cap.implementation, col.status)} ${pad(cap.tool, col.tool)} ${pad(cap.dimension, col.dim)} ${pad(cap.category, col.category)} ${cap.label}${checks}`
    )
    if (cap.verify) console.log(`         verify: ${cap.verify}`)
  }

  console.log('\n--- Local iteration commands ---\n')
  console.log('  npm run demo:audit:offline   # HTML/metadata/copy (fastest)')
  console.log('  npm run demo:audit           # Live localhost rendered pages')
  console.log('  npm run demo:audit:flow      # CTA click flow on localhost')
  console.log('  npm run demo:audit:production # Full production smoke (post-deploy)')
  console.log('  npm run test:unit            # All check modules + fixture regression')
}

main()
