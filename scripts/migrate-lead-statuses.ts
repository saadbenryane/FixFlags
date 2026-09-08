/**
 * Inventory legacy lead statuses.
 *
 * QUALIFIED is legacy-only. Outbound potential is deriveLeadPotential at read time
 * (H/M/L from linkedUserId + scanCount). This script never auto-writes QUALIFIED.
 *
 * Usage: npm run migrate:lead-statuses [-- --dry-run]
 */
import { PrismaClient } from '@prisma/client'
import { mergeLeadStatusOnBackfill } from '../lib/leads/merge-status'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function main() {
  const leads = await prisma.lead.findMany({
    select: {
      id: true,
      normalizedDomain: true,
      status: true,
      linkedUserId: true,
      scanCount: true,
    },
    orderBy: { normalizedDomain: 'asc' },
  })

  let unchanged = 0
  let wouldTouch = 0
  const legacyQualified: string[] = []
  const samples: Array<{
    domain: string
    before: string
    after: string
    linkedUserId: string | null
  }> = []

  for (const lead of leads) {
    if (lead.status === 'QUALIFIED') {
      legacyQualified.push(lead.normalizedDomain)
    }

    // Preserve manual workflow + legacy QUALIFIED; NEW stays NEW.
    const nextStatus = mergeLeadStatusOnBackfill({
      currentStatus: lead.status,
      scanCount: lead.scanCount,
    })

    if (nextStatus === lead.status) {
      unchanged++
      continue
    }

    // mergeLeadStatusOnBackfill is identity for current rules; keep a write path
    // only if future rules diverge, still never auto-promote to QUALIFIED.
    wouldTouch++
    if (samples.length < 10) {
      samples.push({
        domain: lead.normalizedDomain,
        before: lead.status,
        after: nextStatus,
        linkedUserId: lead.linkedUserId,
      })
    }

    if (!dryRun && nextStatus !== 'QUALIFIED') {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: nextStatus },
      })
    }
  }

  console.log(
    dryRun
      ? `Dry run: ${wouldTouch} would change, ${unchanged} unchanged (${leads.length} total)`
      : `Inventory complete: ${wouldTouch} updated, ${unchanged} unchanged (${leads.length} total)`
  )
  console.log(`Legacy QUALIFIED rows: ${legacyQualified.length}`)

  if (samples.length > 0) {
    console.log('\nSample changes:')
    for (const row of samples) {
      console.log(
        `  ${row.domain}: ${row.before} → ${row.after} (linkedUserId=${row.linkedUserId ?? 'null'})`
      )
    }
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
