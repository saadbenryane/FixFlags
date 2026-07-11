/**
 * Post-deploy smoke: verify prod health and that a scan completes with triage.
 *
 * Run:
 *   npx tsx scripts/smoke-triage-prod.ts
 *   npx tsx scripts/smoke-triage-prod.ts https://fixflags.com
 */
const BASE = (process.argv[2] ?? 'https://fixflags.com').replace(/\/$/, '')
const POLL_URL = `${BASE}/demo`
const DETERMINISTIC_STUB =
  'Deterministic scan complete. Sign up to unlock AI review, fix prompts, and rubric analysis.'

async function main() {
  console.log(`Smoke triage prod: ${BASE}\n`)

  const health = await fetch(`${BASE}/api/health`).then((r) => r.json())
  console.log('Health:', JSON.stringify(health, null, 2))

  if (!health.storageConfigured) {
    console.error('FAIL: storageConfigured is false')
    process.exit(1)
  }
  if (!health.aiConfigured) {
    console.error(
      'FAIL: aiConfigured is false. Set OPENAI_API_KEY or ANTHROPIC_API_KEY on Railway and redeploy.'
    )
    process.exit(1)
  }

  const aiHealth = await fetch(`${BASE}/api/health/ai?validate=1`).then((r) => r.json())
  console.log('AI health:', JSON.stringify(aiHealth, null, 2))

  if (aiHealth.validation && !aiHealth.validation.ok) {
    console.error(
      'FAIL: AI provider credentials invalid:',
      aiHealth.validation.provider,
      aiHealth.validation.error
    )
    console.error(
      'Update OPENAI_API_KEY or ANTHROPIC_API_KEY on Railway and redeploy.'
    )
    process.exit(1)
  }

  const create = await fetch(`${BASE}/api/checks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: POLL_URL }),
  }).then((r) => r.json())

  if (!create.reportId) {
    console.error('FAIL: could not create audit', create)
    process.exit(1)
  }

  const auditId = create.reportId as string
  console.log(`Audit ${auditId} created, polling...`)

  for (let i = 0; i < 60; i++) {
    const status = await fetch(`${BASE}/api/reports/${auditId}/status`).then((r) => r.json())
    console.log(`  [${i + 1}] ${status.status} score=${status.score ?? '-'} triageAt=${status.triageAt ?? 'null'}`)

    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
      if (status.status === 'FAILED') {
        console.error('FAIL: audit ended FAILED', status.failureCode, status.errorMsg)
        process.exit(1)
      }
      if (!status.triageAt) {
        console.error('FAIL: audit COMPLETED without triageAt (triage did not run)')
        console.error('failureCode:', status.failureCode)
        console.error('errorMsg:', status.errorMsg)
        process.exit(1)
      }
      if (status.verdict === DETERMINISTIC_STUB) {
        console.error('FAIL: verdict is still the old deterministic-only stub')
        process.exit(1)
      }
      console.log('\nPASS: triage completed successfully')
      console.log(`Report: ${BASE}/report/${auditId}`)
      return
    }
    await new Promise((r) => setTimeout(r, 5000))
  }

  console.error('FAIL: timed out waiting for audit')
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
