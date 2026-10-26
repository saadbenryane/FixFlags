import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlassHeroMark } from '../GlassHeroMark'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

function environment(enabled: boolean) {
  const listeners = new Set<() => void>()
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  let time = 0
  const media = { matches: enabled, addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener) }
  vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList)
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++nextFrame; frames.set(id, callback); return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id) })
  const view = render(<section><GlassHeroMark /></section>)
  const surface = view.container.firstElementChild as HTMLElement
  const scene = surface.firstElementChild as HTMLDivElement
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect)
  const flush = (elapsed = 1000 / 60) => { time += elapsed; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)) }
  return { ...view, surface, scene, request, frames,
    preference(value: boolean) { media.matches = value; listeners.forEach(listener => listener()) },
    flush,
    settle() { for (let count = 0; frames.size && count < 120; count++) flush(); expect(frames.size).toBe(0) },
  }
}

function point(element: HTMLElement, pointerType = 'mouse') {
  const event = new MouseEvent('pointermove', { clientX: 300, clientY: 100, bubbles: true })
  Object.defineProperty(event, 'pointerType', { value: pointerType })
  fireEvent(element, event)
}

describe('glass hero interaction lifecycle', () => {
  it('coalesces pointer input, eases the light and settles back without an idle render loop', () => {
    const fixture = environment(true)
    expect(fixture.scene).toHaveAttribute('aria-hidden', 'true')
    point(fixture.surface); point(fixture.surface)
    expect(fixture.request).toHaveBeenCalledTimes(1)
    fixture.flush()
    const intensity = Number(fixture.scene.style.getPropertyValue('--glass-active'))
    expect(intensity).toBeGreaterThan(0)
    expect(intensity).toBeLessThan(1)
    fixture.settle()
    expect(Number(fixture.scene.style.getPropertyValue('--glass-active'))).toBe(1)
    fireEvent.pointerLeave(fixture.surface)
    fixture.flush()
    expect(Number(fixture.scene.style.getPropertyValue('--glass-active'))).toBeGreaterThan(0)
    fixture.settle()
    expect(fixture.scene.getAttribute('style')).toBe('')
  })

  it('stays still for reduced motion and responds when that preference changes', () => {
    const fixture = environment(false)
    point(fixture.surface)
    expect(fixture.request).not.toHaveBeenCalled()
    fixture.preference(true)
    point(fixture.surface)
    fixture.flush()
    expect(Number(fixture.scene.style.getPropertyValue('--glass-active'))).toBeGreaterThan(0)
    const requests = fixture.request.mock.calls.length
    fixture.preference(false)
    point(fixture.surface)
    expect(fixture.request).toHaveBeenCalledTimes(requests)
    expect(fixture.frames.size).toBe(0)
    expect(fixture.scene.getAttribute('style')).toBe('')
  })

  it('leaves touch scrolling alone and releases pending work on unmount', () => {
    const fixture = environment(true)
    point(fixture.surface, 'touch')
    expect(fixture.request).not.toHaveBeenCalled()
    point(fixture.surface)
    expect(fixture.frames.size).toBe(1)
    fixture.unmount()
    expect(fixture.frames.size).toBe(0)
    point(fixture.surface)
    expect(fixture.request).toHaveBeenCalledTimes(1)
  })
})
