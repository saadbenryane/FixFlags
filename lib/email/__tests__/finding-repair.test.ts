import { beforeEach, describe, expect, it, vi } from 'vitest'
import { observationsForFlag } from '@/lib/audit/flag-observations'
const mocks = vi.hoisted(() => ({ flags: vi.fn(), site: vi.fn(), task: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { flag: { findMany: mocks.flags } } }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.site }))
vi.mock('@/lib/sites/application/flag-copy-task', () => ({ loadSiteFlagCopyTask: mocks.task }))
import { loadEmailRepairFindings } from '../finding-repair'

const finding = { id: 'original', checkId: 'unoptimized-images', problem: 'Images are not optimized',
  rubric: 'EXPERIENCE', severity: 'IMPORTANT', pageUrl: 'https://example.com/shop' }
const row = { ...finding, auditId: 'source-audit', evidence: 'Image savings: 2MB', whyItMatters: 'Large images',
  fix: '', agentPrompt: null, verificationRule: 'Remeasure the same images.', affectedPaths: [finding.pageUrl],
  supportingObservations: observationsForFlag({ ...finding, source: 'DETERMINISTIC', evidence: 'Image savings: 2MB',
    evidenceTargets: [{ kind: 'page', source: 'measured', device: 'mobile', label: 'Original image measurement', context: 'private-measurement-context' }] }) }
beforeEach(() => { vi.resetAllMocks(); mocks.flags.mockResolvedValue([row]); mocks.site.mockResolvedValue({ siteId: 'project', projectId: 'project', userId: 'owner' }); mocks.task.mockResolvedValue({ prompt: 'Canonical revision-bound repair task', promptHash: 'a'.repeat(64), source: { sourceAuditId: 'source-audit', checkId: finding.checkId, problem: finding.problem, pageUrl: finding.pageUrl } }) })

describe('notification repair evidence', () => {
  it('loads the exact selected finding under current ownership and projects only safe handoff fields', async () => {
    const [result] = await loadEmailRepairFindings('project', 'owner', [finding])
    expect(mocks.flags).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['original'] }, audit: {
      projectId: 'project', project: { userId: 'owner', deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
    } } }))
    expect(result).toMatchObject({ sourceAuditId: 'source-audit', repairPrompt: 'Canonical revision-bound repair task', repairPromptHash: 'a'.repeat(64) })
    expect(result).not.toHaveProperty('fix')
    expect(result).not.toHaveProperty('supportingObservations')
    expect(JSON.stringify(result)).not.toContain('private-measurement-context')
    expect(row.fix).toBe('')
    expect(mocks.task).toHaveBeenCalledWith(expect.objectContaining({ userId: 'owner', projectId: 'project' }), 'original')
  })
  it.each([{ checkId: 'other' }, { problem: 'Changed diagnosis' }, { pageUrl: 'https://other.example/' }])('does not borrow changed source context: %j', changed => {
    mocks.flags.mockResolvedValue([{ ...row, ...changed }])
    return expect(loadEmailRepairFindings('project', 'owner', [finding])).resolves.toEqual([finding])
  })
  it('does not invent repair evidence when a source is gone or unreadable', async () => {
    mocks.flags.mockResolvedValueOnce([])
    expect(await loadEmailRepairFindings('project', 'owner', [finding])).toEqual([finding])
    mocks.flags.mockResolvedValueOnce([{ ...row, supportingObservations: { version: 99 } }])
    mocks.task.mockResolvedValueOnce({ prompt: 'Do not change the website based on this record. Run a fresh check.', promptHash: 'b'.repeat(64), source: { sourceAuditId: 'source-audit', checkId: finding.checkId, problem: finding.problem, pageUrl: finding.pageUrl } })
    expect(await loadEmailRepairFindings('project', 'owner', [finding])).toMatchObject([{ repairPrompt: 'Do not change the website based on this record. Run a fresh check.' }])
  })
  it('bounds hydration to findings actually shown in the email', async () => {
    await loadEmailRepairFindings('project', 'owner', Array.from({ length: 100 }, (_, i) => ({ ...finding, id: String(i) })))
    expect(mocks.flags.mock.calls[0][0].where.id.in).toHaveLength(8)
  })
  it('refuses a changed canonical source instead of freezing a different task under the old email heading', async () => {
    mocks.task.mockResolvedValue({ prompt: 'Different task', promptHash: 'a'.repeat(64),
      source: { sourceAuditId: 'source-audit', checkId: finding.checkId, problem: 'Different problem', pageUrl: finding.pageUrl } })
    await expect(loadEmailRepairFindings('project', 'owner', [finding])).rejects.toThrow('source changed during preparation')
  })

})
