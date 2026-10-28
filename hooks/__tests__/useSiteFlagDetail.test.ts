import { createElement } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { afterEach, expect, it, vi } from 'vitest'
import { siteFlagFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { useSiteFlagDetail } from '../useSiteFlagDetail'

const panel = { flag: { ...siteFlagFixture(), sourceAuditId: 'audit-1',
  fix: 'Private repair instructions', repairGuidance: 'ready', expectedBehavior: 'The action works.',
  evidenceMissing: false, viewport: 'mobile', supportingObservations: [], supportingEvidenceUnreadable: false,
  performanceEvidenceSource: null, verifying: false }, capture: null }
function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(SWRConfig, { value: { provider: () => new Map(), shouldRetryOnError: false } }, children)
}
afterEach(() => vi.unstubAllGlobals())

it('removes retained owner detail immediately when repair permission changes', async () => {
  const reads: Array<(response: Response) => void> = []
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { reads.push(resolve) })))
  const { result, rerender, unmount } = renderHook(({ owner }) => useSiteFlagDetail('site', 'flag-1', 'same-observation', owner),
    { wrapper, initialProps: { owner: true } })
  try {
    await waitFor(() => expect(reads).toHaveLength(1))
    await act(async () => { reads[0](Response.json(panel)) })
    expect(result.current.data?.flag.fix).toBe('Private repair instructions')
    rerender({ owner: false })
    expect(result.current.data).toBeNull()
    await waitFor(() => expect(reads).toHaveLength(2))
    await act(async () => { reads[1](Response.json(panel)) })
    expect(result.current.data?.flag.fix).toBe('')
    expect(result.current.data?.flag.repairGuidance).toBe('unavailable')
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
