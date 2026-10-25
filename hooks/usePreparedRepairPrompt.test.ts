import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePreparedRepairPrompt } from './usePreparedRepairPrompt'
import { prepareRepairPrompt, type PreparedRepairPrompt, type RepairPromptScope } from '@/lib/sites/repair-prompt-client'

vi.mock('@/lib/sites/repair-prompt-client', () => ({ prepareRepairPrompt: vi.fn() }))
afterEach(() => vi.clearAllMocks())
const value = (prompt: string): PreparedRepairPrompt => ({ prompt, tasks: [{ sourceFlagId: 'one', promptHash: prompt }] })
it('restarts an aborted Strict Mode prefetch and discards its late response', async () => {
  const pending: Array<{ signal: AbortSignal; resolve: (value: PreparedRepairPrompt) => void }> = []
  vi.mocked(prepareRepairPrompt).mockImplementation((_scope, signal) => new Promise(resolve => pending.push({ signal, resolve })))
  const { result } = renderHook(() => usePreparedRepairPrompt({ kind: 'flag', siteId: 'site-1', flagId: 'one' }, true, true), {
    reactStrictMode: true,
  })
  await waitFor(() => expect(pending).toHaveLength(2))
  expect(pending[0].signal.aborted).toBe(true)
  await act(async () => pending[1].resolve(value('Current prompt')))
  await waitFor(() => expect(result.current.preview).toBe('Current prompt'))
  await act(async () => pending[0].resolve(value('Aborted prompt')))
  expect(result.current.preview).toBe('Current prompt')
  expect(result.current.unavailable).toBeNull()
})
it('aborts the prior scope and never publishes its instructions into the next Site', async () => {
  const pending: Array<{ signal: AbortSignal; resolve: (value: PreparedRepairPrompt) => void }> = []
  vi.mocked(prepareRepairPrompt).mockImplementation((_scope, signal) => new Promise(resolve => pending.push({ signal, resolve })))
  const scope: RepairPromptScope = { kind: 'flag', siteId: 'site-1', flagId: 'one' }
  const { result, rerender, unmount } = renderHook(({ scope }) => usePreparedRepairPrompt(scope, true, true), { initialProps: { scope } })
  rerender({ scope: { ...scope, siteId: 'site-2' } })
  expect(pending[0].signal.aborted).toBe(true)
  await act(async () => pending[0].resolve(value('Other Site prompt')))
  expect(result.current.preview).toBeNull()
  await act(async () => pending[1].resolve(value('Selected Site prompt')))
  expect(result.current.preview).toBe('Selected Site prompt')
  unmount()
})
