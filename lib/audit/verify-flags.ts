import { prisma } from '@/lib/db'
import { DeterministicFlag } from './checks'
import { runDeterministicAudit } from './deterministic-audit'
import { serializeFlowData } from './flow/flow-url'
import { verifiableCheckIds } from './verification-rules'
import type { FlagStatus, Severity } from '@prisma/client'

export {
  allCheckIdsHaveVerificationRules,
  verificationRuleForCheckId,
} from './verification-rules'

const VERIFIABLE_CHECK_IDS = new Set(verifiableCheckIds())

const severityRank: Record<Severity, number> = {
  CRITICAL: 3,
  IMPORTANT: 2,
  POLISH: 1,
}

function currentVerifiableCheckIds(flags: DeterministicFlag[]): Set<string> {
  return new Set(
    flags.filter((f) => VERIFIABLE_CHECK_IDS.has(f.checkId)).map((f) => f.checkId)
  )
}

/** True when a parent flag checkId still fails on re-check (used in tests). */
export function isCheckStillFailing(checkId: string, currentCheckIds: Set<string>): boolean {
  return currentCheckIds.has(checkId)
}

/** Build current check IDs from deterministic audit output (used in tests). */
export function buildCurrentVerifiableCheckIds(flags: DeterministicFlag[]): Set<string> {
  return currentVerifiableCheckIds(flags)
}

/** Re-run deterministic checks on re-check and mark flags verified when checkId clears. */
export async function applyDeterministicVerification(
  recheckAuditId: string,
  parentAuditId: string,
  url: string
): Promise<void> {
  const parentFlags = await prisma.flag.findMany({
    where: {
      auditId: parentAuditId,
      checkId: { in: [...VERIFIABLE_CHECK_IDS] },
    },
  })

  if (parentFlags.length === 0) return

  let auditResult
  try {
    auditResult = await runDeterministicAudit(url, {
      includeFlow: true,
      auditId: recheckAuditId,
    })
  } catch {
    return
  }

  if (auditResult.flowResult) {
    await prisma.audit.update({
      where: { id: recheckAuditId },
      data: {
        flowData: serializeFlowData(auditResult.flowResult) as never,
      },
    })
  }

  const currentCheckIds = currentVerifiableCheckIds(auditResult.flags)

  for (const flag of parentFlags) {
    if (!flag.checkId || !VERIFIABLE_CHECK_IDS.has(flag.checkId)) continue
    const stillFails = currentCheckIds.has(flag.checkId)
    await prisma.flag.update({
      where: { id: flag.id },
      data: {
        status: stillFails ? 'OPEN' : 'FIXED',
        resolvedInId: stillFails ? null : recheckAuditId,
      },
    })
  }

  const recheckFlags = await prisma.flag.findMany({
    where: {
      auditId: recheckAuditId,
      checkId: { in: [...VERIFIABLE_CHECK_IDS] },
    },
  })

  for (const flag of recheckFlags) {
    if (!flag.checkId) continue
    const parentMatch = parentFlags.find((p) => p.checkId === flag.checkId)
    if (!parentMatch) continue
    const stillFails = currentCheckIds.has(flag.checkId)
    let status: FlagStatus = stillFails ? 'OPEN' : 'FIXED'
    if (stillFails && parentMatch.severity !== flag.severity) {
      if (severityRank[flag.severity] > severityRank[parentMatch.severity]) {
        status = 'REGRESSED'
      }
    }
    await prisma.flag.update({
      where: { id: flag.id },
      data: { status },
    })
  }
}

export type { DeterministicFlag }
