import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { downloadRepairFile } from '../repair-prompt-client'
import { buildSiteRepairHandoff, prepareSiteRepairBrief } from '../repair-brief'
import { repairFileSchema } from '../repair-file-contract'
import { repairFlag } from './fixtures/repair-brief'

const scope = { kind: 'flag' as const, siteId: 'site', flagId: 'original' }
const handoff = buildSiteRepairHandoff('site', repairFlag(), 'https://fixflags.test')
const prepared = { prompt: handoff.prompt!, tasks: [{ sourceFlagId: 'original', promptHash: handoff.promptHash! }] }
const input = { kind: 'flag' as const, flagId: 'original', expectedPromptHash: handoff.promptHash! }
function file() {
  const tasks = [prepareSiteRepairBrief('site', repairFlag(), 'https://fixflags.test').complete()]
  return repairFileSchema.parse({ schemaVersion: 'fixflags.repair-file.v1', siteId: 'site', scope: input, instructions: [], tasks,
    completion: { taskCount: 1, taskArraySha256: createHash('sha256').update(JSON.stringify(tasks)).digest('hex'), complete: true } })
}
const link = { href: '', download: '', click: vi.fn(), remove: vi.fn() }
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.stubGlobal('document', { body: { append: vi.fn() }, createElement: vi.fn(() => link) })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:repair-fixture')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(file()) + '\n', { headers: { 'Content-Type': 'application/json; charset=utf-8' } })))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('complete repair file download', () => {
  it('offers the complete owned file without a clipboard write or handoff receipt and releases its Blob URL', async () => {
    await downloadRepairFile(scope, prepared, new AbortController().signal)
    expect(link.click).toHaveBeenCalledOnce()
    expect(link.download).toBe('fixflags-repairs.json')
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/api/sites/site/fix-prompt?view=file', expect.objectContaining({ body: JSON.stringify(input) }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:repair-fixture')
  })
  it.each(['truncated', 'other-site', 'other-scope', 'missing-task', 'cancelled'] as const)('does not save a %s file', async failure => {
    const value = file()
    if (failure === 'other-site') value.siteId = 'another-site'
    if (failure === 'other-scope' && value.scope.kind === 'flag') value.scope.flagId = 'another-flag'
    if (failure === 'missing-task') value.completion.taskCount = 2
    const json = JSON.stringify(value) + '\n'
    vi.mocked(fetch).mockResolvedValue(new Response(failure === 'truncated' ? json.slice(0, -20) : json,
      { headers: { 'Content-Type': 'application/json' } }))
    const cancelled = new AbortController()
    if (failure === 'cancelled') cancelled.abort()
    await expect(downloadRepairFile(scope, prepared, cancelled.signal)).rejects.toThrow()
    expect(link.click).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it('preserves the revision refusal and does not save an error response', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ message: 'Review changed instructions', code: 'REPAIR_TASK_CHANGED' }, { status: 409 }))
    await expect(downloadRepairFile(scope, prepared, new AbortController().signal))
      .rejects.toMatchObject({ message: 'Review changed instructions', status: 409, code: 'REPAIR_TASK_CHANGED' })
    expect(link.click).not.toHaveBeenCalled()
  })
})
