import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useSettingsDraft } from './useSettingsDraft'
import { clearSettingsDrafts } from '@/lib/settings/drafts'

afterEach(() => { cleanup(); clearSettingsDrafts(); vi.clearAllMocks() })
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
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

it('retires a retained draft when a save is confirmed after route unmount', () => {
  const first = mount()
  act(() => first.result.current.change({ name: 'Submitted' }))
  const submitted = first.result.current.snapshot(), acknowledge = first.result.current.acknowledge
  first.unmount()
  act(() => acknowledge(submitted, { name: 'Submitted' }))
  const next = renderHook(({ saved }) => useSettingsDraft('owner', 'profile', saved), {
    initialProps: { saved: { ...initial, name: 'Submitted' } },
  })
  expect(next.result.current.dirty).toBe(false)
  const confirmed = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(confirmed)
  expect(confirmed.defaultPrevented).toBe(false)
  next.rerender({ saved: { ...initial, name: 'Newer server value' } })
  expect(next.result.current.values.name).toBe('Newer server value')
  expect(next.result.current.dirty).toBe(false)
})

it('refreshes a cached baseline on return after an off-route save without retaining an unload warning', () => {
  const first = mount()
  act(() => first.result.current.change({ name: 'Submitted' }))
  const submitted = first.result.current.snapshot(), acknowledge = first.result.current.acknowledge
  first.unmount()
  act(() => acknowledge(submitted, { name: 'Submitted' }))
  const unloaded = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(unloaded)
  expect(unloaded.defaultPrevented).toBe(false)
  expect(navigation.refresh).not.toHaveBeenCalled()
  const returned = renderHook(({ saved }) => useSettingsDraft('owner', 'profile', saved), { initialProps: { saved: initial } })
  renderHook(() => useSettingsDraft('owner', 'email', { hour: 9 }))
  expect(navigation.refresh).toHaveBeenCalledTimes(1)
  returned.rerender({ saved: { ...initial, name: 'Submitted' } })
  expect(returned.result.current.values.name).toBe('Submitted')
  expect(returned.result.current.dirty).toBe(false)
})

it('refreshes an already returned form after an old save without erasing its newer edit', () => {
  const first = mount()
  act(() => first.result.current.change({ name: 'Submitted' }))
  const submitted = first.result.current.snapshot(), acknowledge = first.result.current.acknowledge
  first.unmount()
  const returned = renderHook(({ saved }) => useSettingsDraft('owner', 'profile', saved), { initialProps: { saved: initial } })
  act(() => returned.result.current.change({ name: 'Newer edit' }))
  act(() => acknowledge(submitted, { name: 'Submitted' }))
  expect(navigation.refresh).toHaveBeenCalledTimes(1)
  returned.rerender({ saved: { ...initial, name: 'Submitted' } })
  expect(returned.result.current.values.name).toBe('Newer edit')
  expect(returned.result.current.dirty).toBe(true)
})

it('shares one baseline refresh across mounted forms after a confirmed mutation', () => {
  const first = mount()
  renderHook(() => useSettingsDraft('owner', 'email', { hour: 9 }))
  act(() => first.result.current.change({ name: 'Submitted' }))
  const submitted = first.result.current.snapshot()
  act(() => first.result.current.acknowledge(submitted, { name: 'Submitted' }))
  expect(navigation.refresh).toHaveBeenCalledTimes(1)
})

it('retires only server-confirmed fields while preserving other unsaved edits', () => {
  const hook = renderHook(({ saved }) => useSettingsDraft('owner', 'profile', saved), { initialProps: { saved: initial } })
  act(() => hook.result.current.change({ name: 'Submitted', email: 'draft@example.com' }))
  hook.rerender({ saved: { ...initial, name: 'Submitted' } })
  expect(hook.result.current.values).toEqual({ name: 'Submitted', email: 'draft@example.com' })
  const dirty = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(dirty)
  expect(dirty.defaultPrevented).toBe(true)
  hook.rerender({ saved: { ...initial, name: 'Newer server value' } })
  expect(hook.result.current.values).toEqual({ name: 'Newer server value', email: 'draft@example.com' })
  expect(hook.result.current.dirty).toBe(true)
  hook.rerender({ saved: { name: 'Newer server value', email: 'draft@example.com' } })
  expect(hook.result.current.dirty).toBe(false)
  const clean = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(clean)
  expect(clean.defaultPrevented).toBe(false)
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
  expect(navigation.refresh).not.toHaveBeenCalled()
  expect(next.result.current.values).toEqual(initial)
  first.unmount(); next.unmount()
  expect(mount().result.current.values).toEqual(initial)
})

it('refuses a previous session confirmation after the same owner is activated again', () => {
  const hook = renderHook(({ saved }) => useSettingsDraft('owner', 'profile', saved), { initialProps: { saved: initial } })
  act(() => hook.result.current.change({ name: 'Old session edit' }))
  const submitted = hook.result.current.snapshot(), acknowledge = hook.result.current.acknowledge
  act(() => clearSettingsDrafts())
  // Re-activation also occurs when a retained route's effects resume. Changing
  // the router callback exercises that lifecycle without changing the owner.
  navigation.refresh = vi.fn()
  hook.rerender({ saved: { ...initial, name: 'New session value' } })
  act(() => acknowledge(submitted, { name: 'Old session edit' }))
  expect(hook.result.current.values.name).toBe('New session value')
  expect(navigation.refresh).not.toHaveBeenCalled()
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
