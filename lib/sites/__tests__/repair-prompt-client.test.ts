import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { copyRepairPrompt, type PreparedRepairPrompt } from '../repair-prompt-client'
import { CLIENT_REQUEST_TIMEOUT_MS } from '@/lib/api/client-request'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'

function prompt(count = 1): PreparedRepairPrompt {
  return { prompt: 'The exact prepared repair instructions', tasks: Array.from({ length: count }, (_, index) => ({
    sourceFlagId: `source-${index}`, referenceFlagId: `incident-${index}`, promptHash: 'a'.repeat(64),
  })) }
}
function receipt() {
  return Response.json({ ok: true, prompt: 'Recorded task', handoff: {
    flagId: 'source', action: 'HANDOFF_COPIED', improvementId: 'incident', sourceReviewId: 'audit',
  } })
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('ClipboardItem', undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => {}) } })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it('shares one deadline across batches, aborts pending receipts, and never starts the remaining batch', async () => {
  const reads: Array<{ signal: AbortSignal; finish: (response: Response) => void }> = []
  const fetcher = vi.fn((_url, options) => new Promise<Response>(finish => reads.push({ signal: options.signal, finish })))
  vi.stubGlobal('fetch', fetcher)
  const copied = vi.fn()
  let settled = false
  const run = copyRepairPrompt({ kind: 'bundle', siteId: 'site' }, prompt(12), copied).then(value => { settled = true; return value })
  await vi.advanceTimersByTimeAsync(0)
  expect(reads).toHaveLength(4)
  expect(copied).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(20_000)
  for (const read of reads.slice()) read.finish(receipt())
  await vi.advanceTimersByTimeAsync(0)
  expect(reads).toHaveLength(8)
  await vi.advanceTimersByTimeAsync(9999)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(await run).toEqual({ copied: true, recording: 'failed', notice: SITE_DASHBOARD_COPY.bundleRecordFailed })
  expect(reads.slice(4).every(read => read.signal.aborted)).toBe(true)
  expect(navigator.clipboard.writeText).toHaveBeenCalledExactlyOnceWith('The exact prepared repair instructions')
  for (const read of reads.slice(4)) read.finish(receipt())
  await vi.advanceTimersByTimeAsync(CLIENT_REQUEST_TIMEOUT_MS)
  expect(fetcher).toHaveBeenCalledTimes(8)
  expect(vi.getTimerCount()).toBe(0)
})

it('starts the recording deadline after preparation and the physical clipboard write complete', async () => {
  let prepare!: (value: PreparedRepairPrompt) => void
  let write!: () => void
  const preparation = new Promise<PreparedRepairPrompt>(resolve => { prepare = resolve })
  vi.mocked(navigator.clipboard.writeText).mockImplementation(() => new Promise<void>(resolve => { write = resolve }))
  const fetcher = vi.fn(() => new Promise<Response>(() => {}))
  vi.stubGlobal('fetch', fetcher)
  let settled = false
  const run = copyRepairPrompt({ kind: 'bundle', siteId: 'site' }, preparation).then(value => { settled = true; return value })
  await vi.advanceTimersByTimeAsync(10_000)
  prepare(prompt())
  await vi.advanceTimersByTimeAsync(10_000)
  expect(fetcher).not.toHaveBeenCalled()
  write()
  await vi.advanceTimersByTimeAsync(CLIENT_REQUEST_TIMEOUT_MS - 1)
  expect(settled).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(await run).toMatchObject({ copied: true, recording: 'failed' })
  expect(fetcher).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('records a full supported bundle with at most four concurrent receipt requests and releases its timers', async () => {
  let active = 0, peak = 0
  const fetcher = vi.fn(async () => {
    peak = Math.max(peak, ++active)
    await Promise.resolve()
    active--
    return receipt()
  })
  vi.stubGlobal('fetch', fetcher)
  expect(await copyRepairPrompt({ kind: 'bundle', siteId: 'site with space' }, prompt(100))).toEqual({ copied: true, recording: 'recorded', notice: null })
  expect(fetcher).toHaveBeenCalledTimes(100)
  expect(peak).toBe(4)
  expect(fetcher).toHaveBeenLastCalledWith('/api/sites/site%20with%20space/flags/incident-99/fix', expect.objectContaining({
    body: JSON.stringify({ action: 'copy', promptHash: 'a'.repeat(64) }),
  }))
  expect(navigator.clipboard.writeText).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})

it('continues recording other tasks after an isolated refusal while time remains', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ message: 'The source changed', code: 'REPAIR_TASK_CHANGED' }, { status: 409 }))
    .mockImplementation(async () => receipt())
  vi.stubGlobal('fetch', fetcher)
  expect(await copyRepairPrompt({ kind: 'bundle', siteId: 'site' }, prompt(8))).toEqual({ copied: true, recording: 'failed', notice: SITE_DASHBOARD_COPY.bundleRecordFailed })
  expect(fetcher).toHaveBeenCalledTimes(8)
  expect(vi.getTimerCount()).toBe(0)
})

it('keeps manual instructions available without recording a handoff when clipboard access is refused', async () => {
  vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Clipboard refused'))
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  expect(await copyRepairPrompt({ kind: 'bundle', siteId: 'site' }, prompt())).toEqual({ copied: false, prompt: 'The exact prepared repair instructions' })
  expect(fetcher).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})

it.each(['writeText', 'write'] as const)('releases an unconfirmed %s and ignores its late completion', async method => {
  let finish!: () => void
  const native = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  if (method === 'write') {
    vi.stubGlobal('ClipboardItem', class { constructor(readonly items: Record<string, Promise<Blob>>) {} })
    Object.assign(navigator.clipboard, { write: native })
  } else vi.mocked(navigator.clipboard.writeText).mockImplementation(native)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const copied = vi.fn()
  let result: Awaited<ReturnType<typeof copyRepairPrompt>> | undefined
  const run = copyRepairPrompt({ kind: 'bundle', siteId: 'site' }, prompt(), copied).then(value => { result = value })
  await vi.advanceTimersByTimeAsync(0)
  expect(native).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(CLIENT_REQUEST_TIMEOUT_MS)
  expect(result).toEqual({ copied: false, prompt: 'The exact prepared repair instructions' })
  await run
  expect(copied).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
  finish()
  await vi.advanceTimersByTimeAsync(0)
  expect(copied).not.toHaveBeenCalled()
  expect(fetcher).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
