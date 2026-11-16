import { createElement } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { siteFlagFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { useSiteFlagDetail } from '../useSiteFlagDetail'

const panel = { flag: { ...siteFlagFixture(), sourceAuditId: 'audit-1',
  fix: 'Private repair instructions', repairGuidance: 'ready', expectedBehavior: 'The action works.',
  evidenceMissing: false, viewport: 'mobile', supportingObservations: [], supportingEvidenceUnreadable: false,
  performanceEvidenceSource: null, verifying: false,
  verificationFeedback: { result: 'still_open', checkedAt: '2026-11-03T00:00:00.000Z' } }, capture: null }
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(SWRConfig, { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
}
afterEach(() => vi.unstubAllGlobals())

it('recovers one interrupted evidence read without replaying a write', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValueOnce(Response.json(panel))
  vi.stubGlobal('fetch', fetcher)
  const { result, unmount } = renderHook(() => useSiteFlagDetail('site', 'flag-1', 'revision', true), { wrapper })
  try {
    await waitFor(() => expect(result.current.data?.flag.evidence).toBe(panel.flag.evidence))
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.every(([, options]) => options.method === undefined)).toBe(true)
    expect(result.current.failed).toBe(false)
  } finally { unmount() }
})

it('does not automatically retry an access refusal', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({}, { status: 403 }))
  vi.stubGlobal('fetch', fetcher)
  const { result, unmount } = renderHook(() => useSiteFlagDetail('site', 'flag-1', 'revision', true), { wrapper })
  try {
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(fetcher).toHaveBeenCalledOnce()
    expect(result.current.data).toBeNull()
  } finally { unmount() }
})

it('removes retained owner detail immediately when repair permission changes', async () => {
  const reads: Array<(response: Response) => void> = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { reads.push(resolve) })))
  const { result, rerender, unmount } = renderHook(({ owner }) => useSiteFlagDetail('site', 'flag-1', 'same-observation', owner),
    { wrapper, initialProps: { owner: true } })
  try {
    await waitFor(() => expect(reads).toHaveLength(1))
    await act(async () => { reads[0](Response.json(panel)) })
    expect(result.current.data?.flag.fix).toBe('Private repair instructions')
    expect(result.current.data?.flag.verificationFeedback?.result).toBe('still_open')
    rerender({ owner: false })
    expect(result.current.data).toBeNull()
    await waitFor(() => expect(reads).toHaveLength(2))
    await act(async () => { reads[1](Response.json(panel)) })
    expect(result.current.data?.flag.fix).toBe('')
    expect(result.current.data?.flag.repairGuidance).toBe('unavailable')
    expect(result.current.data?.flag.verificationFeedback).toBeNull()
  } finally { unmount() }
})

it('never stores late owner instructions in a read requested without repair permission', async () => {
  const reads: Array<(response: Response) => void> = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { reads.push(resolve) })))
  const { result, rerender, unmount } = renderHook(({ owner }) => useSiteFlagDetail('site', 'flag-1', 'same-observation', owner),
    { wrapper, initialProps: { owner: false } })
  try {
    await waitFor(() => expect(reads).toHaveLength(1))
    rerender({ owner: true })
    await waitFor(() => expect(reads).toHaveLength(2))
    await act(async () => { reads[1](Response.json(panel)); reads[0](Response.json(panel)) })
    rerender({ owner: false })
    await waitFor(() => expect(result.current.data?.flag.fix).toBe(''))
    expect(result.current.data?.flag.repairGuidance).toBe('unavailable')
    expect(result.current.data?.flag.verificationFeedback).toBeNull()
  } finally { unmount() }
})

it('retains dated detail during a same-viewer observation refresh', async () => {
  const reads: Array<(response: Response) => void> = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { reads.push(resolve) })))
  const { result, rerender, unmount } = renderHook(({ revision }) => useSiteFlagDetail('site', 'flag-1', revision, true),
    { wrapper, initialProps: { revision: 'first' } })
  try {
    await waitFor(() => expect(reads).toHaveLength(1))
    await act(async () => { reads[0](Response.json(panel)) })
    rerender({ revision: 'next' })
    expect(result.current.data?.flag.evidence).toBe(panel.flag.evidence)
    expect(result.current.stale).toBe(true)
    await act(async () => { reads[1](Response.json({ ...panel, flag: { ...panel.flag, status: 'FIXED' } })) })
    expect(result.current.data?.flag.status).toBe('FIXED')
    expect(result.current.stale).toBe(false)
  } finally { unmount() }
})
