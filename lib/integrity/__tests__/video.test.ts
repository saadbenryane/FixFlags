import type { Page } from 'playwright'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureWalkStep, persistWalkVideo } from '../video'
import type { PathStepEvidence } from '../types'

const mocks = vi.hoisted(() => ({ upload: vi.fn(), compose: vi.fn(), owner: vi.fn() }))
vi.mock('../storage', () => ({ uploadIntegrityArtifact: mocks.upload }))
vi.mock('@/lib/audit/capture/gif-compositor', () => ({ composeGif: mocks.compose }))
vi.mock('@/lib/audit/execution-ownership', () => ({ currentExecutionOwnership: mocks.owner }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })
function fixture() {
  const close = vi.fn().mockResolvedValue(undefined)
  const screenshot = vi.fn().mockResolvedValue(Buffer.from('frame'))
  const page = { url: () => 'https://store.example/cart', screenshot,
    video: () => null, context: () => ({ close }) } as unknown as Page
  const steps: PathStepEvidence[] = [{ label: 'landing', url: 'https://store.example/', screenshotUrl: null },
    { label: 'cart', url: 'https://store.example/cart', screenshotUrl: null }]
  return { page, close, screenshot, steps, stepPngs: [null, Buffer.from('frame')] }
}

describe('optional walk media', () => {
  it('captures observations without storage and keeps missing frames aligned', async () => {
    const { page, screenshot } = fixture()
    const steps: PathStepEvidence[] = [], frames: Array<Buffer | null> = []
    screenshot.mockRejectedValueOnce(new Error('Screenshot unavailable'))
    await captureWalkStep(page, 'landing', steps, frames)
    await captureWalkStep(page, 'cart', steps, frames)
    expect(steps.map(step => step.screenshotUrl)).toEqual([null, null])
    expect(frames).toEqual([null, Buffer.from('frame')])
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('discards a frame captured across navigation', async () => {
    const { page, screenshot } = fixture()
    const url = vi.spyOn(page, 'url').mockReturnValueOnce('https://store.example/').mockReturnValue('https://store.example/cart')
    const steps: PathStepEvidence[] = [], frames: Array<Buffer | null> = []
    await captureWalkStep(page, 'landing', steps, frames)
    expect(screenshot).toHaveBeenCalled()
    expect(steps[0].url).toBe('https://store.example/')
    expect(frames).toEqual([null])
    url.mockRestore()
  })
  it('closes the context before media, preserves original frame indices and composes only available frames', async () => {
    const input = fixture()
    mocks.upload.mockImplementation(async (_run, filename) => {
      expect(input.close).toHaveBeenCalledOnce()
      return { url: 'asset/' + filename }
    })
    mocks.compose.mockResolvedValue({ buffer: Buffer.from('gif') })
    expect(await persistWalkVideo({ ...input, runId: 'run', attempt: 2 })).toEqual({ videoUrl: null, gifUrl: 'asset/attempt-2.gif' })
    expect(input.steps.map(step => step.screenshotUrl)).toEqual([null, 'asset/attempt-2-1-cart.png'])
    expect(mocks.compose.mock.calls[0][0]).toEqual([{ buffer: Buffer.from('frame'), delayMs: 900 }])
    expect(mocks.upload.mock.calls[0][4].signal.aborted).toBe(true)
  })
  it('does not store media if context closure fails', async () => {
    const input = fixture()
    input.close.mockRejectedValue(new Error('Native closure unavailable'))
    expect(await persistWalkVideo({ ...input, runId: 'run', attempt: 1 })).toEqual({ videoUrl: null, gifUrl: null })
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.compose).not.toHaveBeenCalled()
  })
  it('settles at its shared deadline and ignores a late upload without launching more work', async () => {
    vi.useFakeTimers()
    const input = fixture()
    let release!: (value: { url: string }) => void
    mocks.upload.mockImplementation(() => new Promise(resolve => { release = resolve }))
    const pending = persistWalkVideo({ ...input, runId: 'run', attempt: 1, deadline: Date.now() + 100 })
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.upload).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(100)
    expect(await pending).toEqual({ videoUrl: null, gifUrl: null })
    release({ url: 'late' })
    await vi.advanceTimersByTimeAsync(0)
    expect(input.steps.every(step => step.screenshotUrl === null)).toBe(true)
    expect(mocks.upload).toHaveBeenCalledOnce()
    expect(mocks.compose).not.toHaveBeenCalled()
  })
  it('cancellation closes the context and stops pending media immediately', async () => {
    const controller = new AbortController(), input = fixture()
    mocks.owner.mockReturnValue({ signal: controller.signal })
    mocks.upload.mockImplementation(() => new Promise(() => {}))
    const pending = persistWalkVideo({ ...input, runId: 'run', attempt: 1 })
    await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce())
    controller.abort(new Error('Execution cancelled'))
    expect(await pending).toEqual({ videoUrl: null, gifUrl: null })
    expect(input.close).toHaveBeenCalledOnce()
    expect(mocks.compose).not.toHaveBeenCalled()
  })
  it('still requests closure when the media budget has already expired', async () => {
    const input = fixture()
    await persistWalkVideo({ ...input, runId: 'run', attempt: 1, deadline: Date.now() - 1 })
    expect(input.close).toHaveBeenCalledOnce()
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('retains confirmed frames when GIF composition fails', async () => {
    const input = fixture()
    mocks.upload.mockResolvedValue({ url: 'confirmed-frame' })
    mocks.compose.mockRejectedValue(new Error('Composition unavailable'))
    expect(await persistWalkVideo({ ...input, runId: 'run', attempt: 1 })).toEqual({ videoUrl: null, gifUrl: null })
    expect(input.steps[1].screenshotUrl).toBe('confirmed-frame')
  })
  it('cleans only its recording directory after delayed native closure acknowledges', async () => {
    const input = fixture()
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'fixflags-media-cleanup-'))
    const recordingDir = path.join(directory, 'recording'), sibling = path.join(directory, 'sibling')
    await fs.mkdir(recordingDir)
    await fs.writeFile(path.join(recordingDir, 'walk.webm'), 'recording')
    await fs.writeFile(sibling, 'retained')
    let release!: () => void
    input.close.mockImplementation(() => new Promise<void>(resolve => { release = resolve }))
    try {
      await persistWalkVideo({ ...input, runId: 'run', attempt: 1, recordingDir, deadline: Date.now() + 30 })
      expect(await fs.readFile(path.join(recordingDir, 'walk.webm'), 'utf8')).toBe('recording')
      expect(mocks.upload).not.toHaveBeenCalled()
      release()
      await vi.waitFor(async () => expect(await fs.stat(recordingDir).catch(() => null)).toBeNull())
      expect(await fs.readFile(sibling, 'utf8')).toBe('retained')
    } finally { release(); await fs.rm(directory, { recursive: true, force: true }) }
  })
})
