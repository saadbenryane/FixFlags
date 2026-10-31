import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { useSettingsDraft } from './useSettingsDraft'
import { clearSettingsDrafts } from '@/lib/settings/drafts'

afterEach(() => { cleanup(); clearSettingsDrafts() })
const initial = { name: 'Original', email: 'owner@example.com' }
const mount = () => renderHook(() => useSettingsDraft('owner', 'profile', initial))

it('retains edited values across route unmounts without retaining clean fields', () => {
  const first = mount()
  act(() => first.result.current.change({ name: 'Draft' }))
  first.unmount()
  const next = renderHook(() => useSettingsDraft('owner', 'profile', { ...initial, email: 'confirmed@example.com' }))
  expect(next.result.current.values).toEqual({ name: 'Draft', email: 'confirmed@example.com' })
  expect(next.result.current.dirty).toBe(true)
})

it('keeps edited fields through a server refresh and accepts confirmed fields independently', () => {
  const hook = renderHook(({ saved }) => useSettingsDraft('owner', 'profile', saved), { initialProps: { saved: initial } })
  act(() => hook.result.current.change({ name: 'Draft' }))
  hook.rerender({ saved: { name: 'Changed elsewhere', email: 'confirmed@example.com' } })
  expect(hook.result.current.values).toEqual({ name: 'Draft', email: 'confirmed@example.com' })
  const submitted = hook.result.current.snapshot()
  act(() => hook.result.current.acknowledge(submitted, { name: 'Draft' }))
  expect(hook.result.current.dirty).toBe(false)
})

it('preserves newer edits when an earlier save finishes', () => {
  const hook = mount()
  act(() => hook.result.current.change({ name: 'Submitted' }))
  const submitted = hook.result.current.snapshot()
  act(() => hook.result.current.change({ name: 'Newer edit' }))
  act(() => hook.result.current.acknowledge(submitted, { name: 'Submitted' }))
  expect(hook.result.current.saved.name).toBe('Submitted')
  expect(hook.result.current.values.name).toBe('Newer edit')
})

it('does not resurrect a discarded or unmounted draft from a late save', () => {
  const hook = mount()
  act(() => hook.result.current.change({ name: 'Submitted' }))
  const submitted = hook.result.current.snapshot(), acknowledge = hook.result.current.acknowledge
  act(() => hook.result.current.discard())
  act(() => acknowledge(submitted, { name: 'Submitted' }))
  expect(hook.result.current.values).toEqual(initial)
  hook.unmount()
  act(() => acknowledge(submitted, { name: 'Submitted' }))
  expect(mount().result.current.dirty).toBe(false)
})

it('isolates owners and refuses an old owner continuation after sign-out', () => {
  const first = mount()
  act(() => first.result.current.change({ name: 'Private edit' }))
  const snapshot = first.result.current.snapshot(), acknowledge = first.result.current.acknowledge
  act(() => clearSettingsDrafts())
  const next = renderHook(() => useSettingsDraft('other-owner', 'profile', initial))
  act(() => acknowledge(snapshot, { name: 'Private edit' }))
  expect(next.result.current.values).toEqual(initial)
  first.unmount(); next.unmount()
  expect(mount().result.current.values).toEqual(initial)
})

it('warns on document unload while any form has a retained draft, including off-route', () => {
  const first = mount()
  const second = renderHook(() => useSettingsDraft('owner', 'email', { hour: 9 }))
  act(() => first.result.current.change({ name: 'Draft' }))
  act(() => second.result.current.change({ hour: 10 }))
  act(() => first.result.current.discard())
  first.unmount(); second.unmount()
  const retained = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(retained)
  expect(retained.defaultPrevented).toBe(true)
  clearSettingsDrafts()
  const cleared = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(cleared)
  expect(cleared.defaultPrevented).toBe(false)
})
