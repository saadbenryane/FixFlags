#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * One-shot migration of historical technology detections into normalized
 * audit observations. This script never re-fetches customer sites.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

import { prisma } from '../../lib/db.js'
import { persistTechnologyObservations } from '../../lib/audit/technology-profile.js'
import { reconcileSiteTechnologies } from '../../lib/graph/persist.js'
import {
  registeredTechnologyKind,
  type DetectedTech,
} from '../../lib/audit/tech-detect.js'

const LEGACY_DETECTOR_VERSION = 'legacy-json-backfill'
// The legacy detector assigned 0.85 to broad HTML text matches. Only its
// script/generator-strength results are safe enough to preserve without the
// original evidence trace.
const LEGACY_MIN_CONFIDENCE = 0.9

function parseArgs(): { limit: number | null; dryRun: boolean } {
  const args = process.argv.slice(2)
  const limitIndex = args.indexOf('--limit')
  const parsed = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Number.NaN
  return {
    limit: Number.isFinite(parsed) ? parsed : null,
    dryRun: args.includes('--dry-run'),
  }
}

function parseLegacyDetections(value: unknown): DetectedTech[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (
      typeof row.name !== 'string' ||
      typeof row.confidence !== 'number' ||
      row.confidence < LEGACY_MIN_CONFIDENCE
    ) {
      return []
    }
    const kind = registeredTechnologyKind(row.name)
    if (!kind) return []
    return [{
      name: row.name.slice(0, 120),
      kind,
      confidence: Math.min(0.99, row.confidence),
      evidence: [{ type: 'html' as const, label: 'Historical capture signal' }],
    }]
  })
}

async function main(): Promise<void> {
  const { limit, dryRun } = parseArgs()
  const audits = await prisma.audit.findMany({
    where: {
      status: 'COMPLETED',
      technologyDetectionStatus: 'NOT_CAPTURED',
    },
    orderBy: { createdAt: 'desc' },
    take: limit ?? undefined,
    select: {
      id: true,
      siteId: true,
      pages: {
        orderBy: { position: 'asc' },
        take: 1,
        select: { performanceData: true },
      },
    },
  })

  let migrated = 0
  let skipped = 0
  for (const audit of audits) {
    const performance = audit.pages[0]?.performanceData as Record<string, unknown> | null
    const detections = parseLegacyDetections(performance?.detectedTech)
    if (detections.length === 0) {
      skipped += 1
      continue
    }
    if (!dryRun) {
      await persistTechnologyObservations(
        audit.id,
        detections,
        'PARTIAL',
        LEGACY_DETECTOR_VERSION
      )
      if (audit.siteId) {
        const latestCompletedAudit = await prisma.audit.findFirst({
          where: { siteId: audit.siteId, status: 'COMPLETED' },
          orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
          select: { id: true },
        })
        if (latestCompletedAudit?.id === audit.id) {
          // Historical signals are partial. They may confirm technologies that
          // are present, but must never infer removals from the current stack.
          await reconcileSiteTechnologies(audit.siteId, detections, false)
        }
      }
    }
    migrated += 1
  }

  console.log(
    `[backfill-tech] ${dryRun ? 'dry-run ' : ''}${migrated} migrated, ${skipped} skipped`
  )
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('[backfill-tech] fatal:', error)
    await prisma.$disconnect()
    process.exit(1)
  })
