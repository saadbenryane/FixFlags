import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { repairFlag, repairObservations } from '@/lib/sites/__tests__/fixtures/repair-brief'
import { buildSiteRepairHandoff } from '@/lib/sites/repair-brief'
import { repairFileSchema, type RepairFileRequest } from '@/lib/sites/repair-file-contract'
import type { SiteRecord } from '@/lib/sites/types'
import { loadRepairSelection } from '../repair-selection'
import { prepareSiteRepairFile, repairFileStream } from '../repair-file'

const mocks = vi.hoisted(() => ({ findings: vi.fn(), flag: vi.fn() }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFindings: mocks.findings, loadSiteFlagDetail: mocks.flag }))
vi.mock('@/lib/get-app-url', () => ({ getAppUrl: () => 'https://fixflags.test' }))
const site = { siteId: 'site', kind: 'project', projectId: 'site', userId: 'owner' } as SiteRecord
const signal = () => new AbortController().signal
const authorized = async () => {}
const single = (flag = repairFlag()): RepairFileRequest => ({ kind: 'flag', flagId: 'original',
  expectedPromptHash: buildSiteRepairHandoff('site', flag, 'https://fixflags.test').promptHash! })
async function collect(stream: AsyncIterable<Uint8Array>) {
  const chunks = []
  for await (const chunk of stream) { expect(chunk.byteLength).toBeLessThanOrEqual(64 * 1024); chunks.push(chunk) }
  return Buffer.concat(chunks).toString('utf8')
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.flag.mockResolvedValue(repairFlag())
  mocks.findings.mockResolvedValue({ flags: [repairFlag({ id: 'original' })] })
})
describe('complete owned repair files', () => {
  it.each([65, 5000])('gives an offline recipient every observation in a %i-record group without private inputs or another read', async count => {
    const observations = repairObservations(count, 'Observed 🧭 control\n'.repeat(count === 65 ? 1000 : 16))
    const flag = { ...repairFlag({ supportingObservations: observations }), encryptedCredentials: 'PRIVATE_VALUE' }
    mocks.flag.mockResolvedValue(flag)
    const json = await collect(await prepareSiteRepairFile(site, single(flag), signal(), authorized))
    const file = repairFileSchema.parse(JSON.parse(json))
    expect(file.tasks).toHaveLength(1)
    expect(file.tasks[0].flag.supportingObservations).toEqual(observations)
    expect(file.tasks[0].repair).toMatchObject({ readiness: 'ready', guidance: flag.fix })
    expect(file.tasks[0].verification).toMatchObject({ rule: flag.verificationRule, independentCheckRequired: true })
    expect(file.tasks[0].verification.afterDeployment.arguments.expectedContextHash).toBe(file.tasks[0].contextHash)
    expect(file.completion.taskArraySha256).toBe(createHash('sha256').update(JSON.stringify(file.tasks)).digest('hex'))
    expect(json).not.toContain('PRIVATE_VALUE')
    expect(json).not.toContain('owner-session-or-developer-key')
    expect(mocks.flag).toHaveBeenCalledTimes(2)
  })
  it('refuses provisional Sites even when called outside the HTTP route', async () => {
    await expect(prepareSiteRepairFile({ ...site, projectId: null, userId: null }, single(), signal(), authorized))
      .rejects.toMatchObject({ status: 404 })
    expect(mocks.flag).not.toHaveBeenCalled()
  })
  it('exports an entire category beyond the copied page with the same selected scope and revision', async () => {
    const flags = Array.from({ length: 103 }, (_, index) => repairFlag({ id: `flag-${index}`, sourceFlagId: `flag-${index}` }))
    mocks.findings.mockResolvedValue({ flags })
    mocks.flag.mockImplementation(async (_site, id) => flags.find(flag => flag.id === id))
    const { manifestHash, flags: selected } = await loadRepairSelection(site, 'conversion')
    const scope = { kind: 'bundle' as const, area: 'conversion' as const, manifestHash }
    const file = repairFileSchema.parse(JSON.parse(await collect(await prepareSiteRepairFile(site, scope, signal(), authorized))))
    expect(file.tasks.map(task => task.referenceFlagId)).toEqual(selected.map(flag => flag.id))
    expect(file.completion.taskCount).toBe(103)
    expect(mocks.flag).toHaveBeenCalledTimes(206)
    await expect(prepareSiteRepairFile(site, { ...scope, flagIds: ['foreign'] }, signal(), authorized)).rejects.toMatchObject({ status: 409 })
  })
  it('rejects changed prepared tasks or manifest revisions before starting a file', async () => {
    await expect(prepareSiteRepairFile(site, { kind: 'flag', flagId: 'original', expectedPromptHash: '0'.repeat(64) }, signal(), authorized))
      .rejects.toMatchObject({ code: 'REPAIR_TASK_CHANGED', status: 409 })
    await expect(prepareSiteRepairFile(site, { kind: 'bundle', manifestHash: '0'.repeat(64) }, signal(), authorized))
      .rejects.toMatchObject({ code: 'REPAIR_MANIFEST_CHANGED', status: 409 })
  })
  it.each(['evidence', 'selection', 'authority'] as const)('does not complete a file when %s changes during delivery', async changed => {
    const { manifestHash } = await loadRepairSelection(site)
    let permitted = true
    const authorize = vi.fn(async () => { if (!permitted) throw new Error('Access revoked') })
    const stream = await prepareSiteRepairFile(site, { kind: 'bundle', manifestHash }, signal(), authorize)
    const head = await stream.next()
    expect(head.done).toBe(false)
    if (changed === 'evidence') mocks.flag.mockResolvedValue(repairFlag({ evidence: 'Changed source' }))
    if (changed === 'selection') mocks.findings.mockResolvedValue({ flags: [] })
    if (changed === 'authority') permitted = false
    await expect(collect(stream)).rejects.toThrow()
  })
  it('stops reading sources when the response consumer cancels', async () => {
    const flags = [repairFlag({ id: 'original' }), repairFlag({ id: 'second' })]
    mocks.findings.mockResolvedValue({ flags })
    const { manifestHash } = await loadRepairSelection(site)
    const cancel = new AbortController()
    const stream = repairFileStream(await prepareSiteRepairFile(site, { kind: 'bundle', manifestHash }, cancel.signal, authorized), cancel)
    const reader = stream.getReader()
    await reader.read()
    await reader.cancel()
    expect(cancel.signal.aborted).toBe(true)
    expect(mocks.flag).toHaveBeenCalledTimes(1)
  })
  it('expires a stalled response without waiting for another consumer pull', async () => {
    const request = new AbortController(), cancel = new AbortController()
    const combined = AbortSignal.any([request.signal, cancel.signal])
    const iterator = await prepareSiteRepairFile(site, single(), combined, authorized)
    const release = vi.spyOn(iterator, 'return')
    const reader = repairFileStream(iterator, cancel, combined).getReader()
    await reader.read()
    request.abort(new Error('Expired request'))
    await expect(reader.closed).rejects.toThrow('Expired request')
    expect(release).toHaveBeenCalledOnce()
    expect(mocks.flag).toHaveBeenCalledTimes(1)
  })
})
