import { describe, expect, it, vi } from 'vitest'
import { publishUnfinishedCoverage } from '../incomplete'

const pageUrl = 'https://example.com/'
function database(executionSpec: unknown = null) {
  return { audit: { findUnique: vi.fn().mockResolvedValue({ executionSpec }) }, auditVerificationReceipt: { upsert: vi.fn() } }
}
describe('unfinished native observation coverage', () => {
  it.each([
    ['flow', undefined, ['flow', 'measurement', 'overlays']],
    ['flow', 'pricing-navigation', ['flow', 'measurement', 'overlays']],
    ['flow', 'form-validation', ['form-validation', 'overlays']],
    ['flow', 'mobile-navigation', ['mobile-navigation']],
    ['journeys', undefined, ['journeys', 'overlays']],
    ['slow-replay', undefined, ['slow-replay']],
    ['overlays', undefined, ['overlays']],
    ['cross-page', undefined, ['corridor']],
    ['discovery', undefined, ['seo']],
    ['automatic-accounts', undefined, ['automatic-accounts']],
  ] as const)('records explicit unavailability for %s / %s', async (workKind, module, modules) => {
    const db = database()
    await publishUnfinishedCoverage(db as never, { id: 'task', auditId: 'audit', workKind,
      workInput: { pageUrl, position: 0, primary: true, role: 'primary', ...(module ? { module } : {}) } }, 'RECOVERY_EXHAUSTED')
    expect(db.auditVerificationReceipt.upsert.mock.calls.map(([input]) => input.create.targetKey))
      .toEqual(modules.map(module => 'module:' + module))
    for (const [input] of db.auditVerificationReceipt.upsert.mock.calls) expect(input).toMatchObject({ update: {}, create: {
      taskId: 'task', status: 'FAILED', scopeKey: expect.stringContaining(':unfinished:task'),
      detail: { passed: false, applicable: true, failed: true, assertions: [] },
    } })
  })

  it('limits a shared action interruption to the admitted category responsibilities', async () => {
    const db = database({ version: 1, engine: 'progressive-v1', targetUrl: pageUrl, scope: 'CATEGORY', environment: 'production',
      checks: { 'tracking-library-http-error': 1 }, outcomes: [], verificationTarget: null,
      category: { area: 'tracking', sourceAuditId: 'source', pages: [pageUrl] } })
    await publishUnfinishedCoverage(db as never, { id: 'task', auditId: 'audit', workKind: 'flow',
      workInput: { pageUrl, position: 0, primary: true, role: 'primary' } }, 'RECOVERY_EXHAUSTED')
    expect(db.auditVerificationReceipt.upsert.mock.calls.map(([input]) => input.create.targetKey)).toEqual(['module:measurement'])
  })

  it('settles an unavailable historical module without requiring a current assertion contract', async () => {
    const db = database()
    await publishUnfinishedCoverage(db as never, { id: 'task', auditId: 'audit', workKind: 'check',
      workInput: { pageUrl, position: 0, primary: true, role: 'primary', module: 'retired-check' } }, 'CHECK_NOT_REGISTERED')
    expect(db.auditVerificationReceipt.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({
      targetKey: 'module:retired-check', status: 'FAILED', detail: expect.objectContaining({ failed: true }),
    }) }))
  })
})
