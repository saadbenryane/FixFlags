/**
 * Phase 1 E2E smoke: flow scan + re-check verification logic on live URLs.
 * Run: DOTENV_CONFIG_PATH=.env.local tsx -r dotenv/config scripts/phase1-e2e-smoke.ts
 */
import assert from 'node:assert/strict'
import { prisma } from '@/lib/db'
import { runFlowScanStandalone } from '@/lib/audit/flow/run-flow-scan'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import {
  buildCurrentVerifiableCheckIds,
  isCheckStillFailing,
} from '@/lib/audit/verify-flags'

const HEALTHY_URL = 'https://example.com'

async function main() {
  console.log('Phase 1 E2E smoke\n')

  const audit = await prisma.audit.create({
    data: {
      url: HEALTHY_URL,
      status: 'QUEUED',
      isPublic: false,
    },
  })

  try {
    console.log(`1. Flow scan on ${HEALTHY_URL}...`)
    const browser = await getAuditBrowser()
    const flowResult = await runFlowScanStandalone(browser, audit.id, HEALTHY_URL)
    assert.ok(flowResult.status, 'flow status set')
    assert.ok(Array.isArray(flowResult.steps), 'flow steps array')
    console.log(`   status=${flowResult.status} steps=${flowResult.steps.length}`)

    const flowFlags = runFlowChecks(flowResult)
    console.log(`   flow flags: ${flowFlags.map((f) => f.checkId).join(', ') || '(none)'}`)

    console.log('2. Re-check verification logic...')
    const deadEndIds = buildCurrentVerifiableCheckIds(
      runFlowChecks({
        status: 'dead_end',
        steps: flowResult.steps,
        finalUrl: flowResult.finalUrl,
        ctaText: flowResult.ctaText,
      })
    )
    const successIds = buildCurrentVerifiableCheckIds(
      runFlowChecks({
        status: 'success',
        steps: flowResult.steps,
        finalUrl: flowResult.finalUrl,
        ctaText: flowResult.ctaText,
      })
    )
    if (flowResult.status === 'dead_end') {
      assert.ok(isCheckStillFailing('flow-cta-dead-end', deadEndIds))
    }
    if (flowResult.status === 'success') {
      assert.equal(isCheckStillFailing('flow-cta-dead-end', successIds), false)
    }
    console.log('   verification logic OK')

    await prisma.audit.update({
      where: { id: audit.id },
      data: {
        flowData: {
          status: flowResult.status,
          steps: flowResult.steps,
          finalUrl: flowResult.finalUrl,
          ctaText: flowResult.ctaText ?? null,
        } as never,
      },
    })

    const stored = await prisma.audit.findUnique({
      where: { id: audit.id },
      select: { flowData: true },
    })
    assert.ok(stored?.flowData, 'flowData persisted')
    console.log('3. flowData persisted to audits table OK')

    console.log('\nSmoke passed.')
  } finally {
    await prisma.audit.delete({ where: { id: audit.id } }).catch(() => {})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
