import { describe, expect, it, vi } from 'vitest'
import type { Prisma } from '@prisma/client'
vi.mock('@/lib/db', () => ({ prisma: {} }))
import { commitFindings, recordedTaskFindings, commitCheckReceipt } from '../results'
import { checkReceiptSchema } from '../../checks/receipt'
const persist = vi.hoisted(() => vi.fn())
vi.mock('@/lib/audit/persist', () => ({ persistDeterministicFlags: persist }))
import { serializeArtifact } from '../contracts'
import type { TaskContext } from '../registry'
import { recordedPageEvidence } from '../lifecycle'

describe('finding publication cost', () => {
  it.each([false, true])('attaches committed judge provenance after artifact parsing without rewriting grouped evidence: %s', async grouped => {
    const flag = { rubric: 'EXPERIENCE', impactTag: 'FRICTION', severity: 'IMPORTANT', problem: 'Action needs review',
      evidence: 'The captured button promises a trial but opens a contact form.', whyItMatters: 'Review the promise and destination.',
      confidence: 0.8, pageUrl: 'https://example.com/',
      ...(grouped ? { supportingReviews: [{ evidence: 'Description sentence one.' }, { evidence: 'Description sentence two.' }] } : {}) }
    const artifact = serializeArtifact('judge', { triage: { output: { pageJob: 'Explain a product', pageType: 'homepage',
      verdict: 'Review the action.', score: 80, launchReadiness: 'fix_first', launchChecklist: [], rubrics: [], newFlags: [flag] },
      usage: { inputTokens: 10, outputTokens: 10, model: 'recorded-provider' } } })
    const original = JSON.stringify(artifact)
    const query = vi.fn().mockResolvedValueOnce([{ id: 'judge-task', workKind: 'judge', workState: 'COMPLETED', status: 'COMPLETED',
      workInput: { position: 0, pageUrl: flag.pageUrl, primary: true }, workResult: artifact }]).mockResolvedValueOnce([])
    const pages = await recordedPageEvidence('original-audit', undefined, { $queryRaw: query } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>)
    const admitted = pages[0].triage?.output.newFlags[0]
    expect(admitted).toMatchObject({ fingerprint: expect.stringMatching(/^ai-observation:v1::/) })
    const observations = (admitted as unknown as { supportingObservations: { items: Array<{ evidence: string; provenance: unknown }> } }).supportingObservations.items
    expect(observations).toHaveLength(grouped ? 2 : 1)
    for (const item of observations) expect(item).toMatchObject({ source: 'AI', checkVersion: null,
      provenance: { auditId: 'original-audit', taskId: 'judge-task', collectedAt: artifact.collectedAt } })
    expect(observations.map(item => item.evidence)).toEqual(grouped ? ['Description sentence one.', 'Description sentence two.'] : [flag.evidence])
    expect(JSON.stringify(artifact)).toBe(original)
  })
  it.each(['browser', 'http'] as const)('retains a %s parser limitation independently of successful native tasks', async kind => {
    const pageUrl = 'https://example.com/'
    const data = kind === 'browser' ? { pageId: 'page', metadata: null,
      metadataFailure: { code: 'PARSER_CRASH', attempts: 2 }, snapshot: { desktopUrl: null, mobileUrl: null, renderedScope: null } }
      : { metadata: null, metadataFailure: { code: 'PARSER_CRASH', attempts: 2 } }
    const query = vi.fn().mockResolvedValueOnce([{ id: kind + '-task', workKind: kind, workState: 'COMPLETED', status: 'COMPLETED',
      workInput: { position: 0, pageUrl, primary: true }, workResult: serializeArtifact(kind, data) }]).mockResolvedValueOnce([])
    const pages = await recordedPageEvidence('audit', undefined, { $queryRaw: query } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>)
    expect(pages).toHaveLength(1)
    expect(pages[0]).toMatchObject({ url: pageUrl, metadata: null, failedModules: ['metadata'] })
  })

  it('does not read the finding ledger or rewrite report rows for a task with no new findings', async () => {
    const read = vi.fn().mockRejectedValue(new Error('An empty result must not rebuild the report'))
    const tx = { $queryRaw: read } as unknown as Prisma.TransactionClient
    await commitFindings({ audit: { id: 'running-analysis' } } as TaskContext,
      serializeArtifact('check', { flags: [] }), tx)
    expect(read).not.toHaveBeenCalled()
  })

  it('rejects malformed incoming findings before reading the ledger', async () => {
    const read = vi.fn()
    await expect(commitFindings({ audit: { id: 'running-analysis' } } as TaskContext,
      serializeArtifact('check', { flags: [{ checkId: 'title-missing' }] }), { $queryRaw: read } as unknown as Prisma.TransactionClient))
      .rejects.toThrow()
    expect(read).not.toHaveBeenCalled()
  })
  it('reconstructs source and admitted version from the original committed task, not the current registry', async () => {
    const flag = { checkId: 'messaging-no-audience', rubric: 'MESSAGE', severity: 'POLISH', problem: 'Audience wording', evidence: 'Original observed headline', fix: 'Review the wording', confidence: 0.8, source: 'DETERMINISTIC', pageUrl: 'https://example.com/' }
    const read = vi.fn().mockResolvedValue([{ taskId: 'original-task', collectedAt: '2026-10-16T10:00:00.000Z', findings: [flag] }])
    const spec = { version: 1, scope: 'SITE', targetUrl: flag.pageUrl, environment: 'production', checks: { 'messaging-no-audience': 1 }, outcomes: [], verificationTarget: null }
    const findings = await recordedTaskFindings('original-audit', { $queryRaw: read } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>, spec)
    expect(findings[0].supportingObservations.items[0]).toMatchObject({ checkVersion: 1, provenance: { auditId: 'original-audit', taskId: 'original-task', collectedAt: '2026-10-16T10:00:00.000Z' } })
    const unknown = await recordedTaskFindings('old-audit', { $queryRaw: read } as unknown as Pick<Prisma.TransactionClient, '$queryRaw'>)
    expect(unknown[0].supportingObservations.items[0].checkVersion).toBeNull()
  })

  it('publishes new findings with the frozen source version while retaining independent committed work', async () => {
    const flag = { checkId: 'title-missing', rubric: 'REACH', severity: 'IMPORTANT', problem: 'Missing title', evidence: 'A title was not present', fix: 'Add a title', confidence: 1, source: 'DETERMINISTIC', pageUrl: 'https://example.com/' }
    const spec = { version: 1, scope: 'SITE', targetUrl: flag.pageUrl, environment: 'production', checks: { 'title-missing': 1 }, outcomes: [], verificationTarget: null }
    const read = vi.fn().mockResolvedValue([{ taskId: 'peer-task', collectedAt: '2026-10-16T10:00:00.000Z', findings: [{ ...flag, pageUrl: 'https://example.com/pricing', evidence: 'Pricing title was not present' }] }])
    await commitFindings({ audit: { id: 'original', executionSpec: spec }, task: { id: 'current-task' } } as TaskContext,
      serializeArtifact('check', { flags: [flag] }), { $queryRaw: read } as unknown as Prisma.TransactionClient)
    const flags = persist.mock.calls.at(-1)![1]
    expect(flags).toHaveLength(2)
    expect(flags[0].supportingObservations.items[0]).toMatchObject({ checkVersion: 1, provenance: { auditId: 'original', taskId: 'current-task' } })
    expect(flags[1].supportingObservations.items[0]).toMatchObject({ pageUrl: 'https://example.com/pricing', provenance: { taskId: 'peer-task' } })
  })

  it('commits the actual module revision and incomplete evidence without manufacturing a pass', async () => {
    const spec = { version: 1, scope: 'CATEGORY', category: { area: 'conversion', sourceAuditId: 'before', pages: ['https://example.com/'] }, targetUrl: 'https://example.com/', environment: 'production', checks: { 'messaging-no-audience': 2 }, outcomes: [], verificationTarget: null }
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'messaging-clarity', passed: true, applicable: true, complete: true, pageUrl: spec.targetUrl,
      assertions: [{ key: 'audience-or-outcome', name: 'Audience', expected: 'Recorded introduction', observed: 'Capture unavailable', passed: false, complete: false }],
      execution: { auditId: 'original', taskId: 'task', checkVersion: 2, source: 'rendered-dom', collectedAt: '2026-10-16T10:00:00.000Z' } })
    const upsert = vi.fn()
    await commitCheckReceipt({ audit: { id: 'original', parentId: null, executionSpec: spec }, task: { id: 'task' }, input: { primary: true } } as TaskContext, receipt,
      {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  auditVerifierExecution: { upsert } } as unknown as Prisma.TransactionClient)
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ checkVersion: 2, detail: expect.objectContaining({ complete: false, passed: false }) }), update: {} }))
    upsert.mockClear()
    await commitCheckReceipt({ audit: { id: 'original', parentId: null, executionSpec: spec }, task: { id: 'task' }, input: {} } as TaskContext,
      checkReceiptSchema.parse({ ...receipt, module: 'console', assertions: [] }), {get auditExecutionTask() { return this.auditVerifierExecution }, get auditVerificationReceipt() { return this.auditVerifierExecution },  auditVerifierExecution: { upsert } } as unknown as Prisma.TransactionClient)
    expect(upsert).not.toHaveBeenCalled()
  })

})
