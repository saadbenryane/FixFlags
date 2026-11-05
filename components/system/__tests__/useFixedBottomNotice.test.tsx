import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFixedBottomNotice } from '../useFixedBottomNotice'

function FixedSurface({ height, priority }: { height: number; priority: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useFixedBottomNotice(ref, true, priority)
  return <div ref={ref} data-height={height} data-testid={priority < 0 ? 'navigation' : 'notice'} />
}

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('shared fixed surfaces', () => {
  it('reserves enlarged navigation and stops reserving it when the desktop layout hides it', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const height = Number((this as HTMLElement).dataset.height ?? 0)
      const bottom = window.innerHeight - Number.parseFloat((this as HTMLElement).style.getPropertyValue('--bottom-notice-offset') || '0')
      return { x: 0, y: bottom - height, top: bottom - height, right: 320, bottom, left: 0, width: 320, height, toJSON() {} } as DOMRect
    })
    const surfaces = (height: number) => <><FixedSurface height={height} priority={-10} /><FixedSurface height={120} priority={10} /></>
    const view = render(surfaces(88))
    const notice = view.getByTestId('notice')
    expect(notice.style.getPropertyValue('--bottom-notice-offset')).toBe('100px')
    expect(document.documentElement.style.getPropertyValue('--bottom-notice-inset')).toBe('220px')

    view.rerender(surfaces(148))
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(notice.style.getPropertyValue('--bottom-notice-offset')).toBe('160px'))
    expect(document.documentElement.style.getPropertyValue('--bottom-notice-inset')).toBe('280px')

    view.rerender(surfaces(0))
    fireEvent(window, new Event('resize'))
    await waitFor(() => expect(notice.style.getPropertyValue('--bottom-notice-offset')).toBe('0px'))
    expect(document.documentElement.style.getPropertyValue('--bottom-notice-inset')).toBe('120px')
    view.unmount()
    expect(document.documentElement.style.getPropertyValue('--bottom-notice-inset')).toBe('0px')
  })

  it('reveals a focused page control that enlarged fixed navigation covers', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const height = Number((this as HTMLElement).dataset.height ?? 0)
      const top = window.innerHeight - height
      return { x: 0, y: top, top, right: 320, bottom: window.innerHeight, left: 0, width: 320, height, toJSON() {} } as DOMRect
    })
    const view = render(<><button data-height="44">Publish repair</button><FixedSurface height={148} priority={-10} /></>)
    const navigation = view.getByTestId('navigation'), control = view.getByRole('button', { name: 'Publish repair' })
    const reveal = vi.fn()
    Object.defineProperty(control, 'scrollIntoView', { configurable: true, value: reveal })
    const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint')
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => navigation })
    try {
      await act(async () => control.focus())
      await waitFor(() => expect(reveal).toHaveBeenCalledWith({ block: 'center', inline: 'nearest' }))
      expect(document.activeElement).toBe(control)
    } finally {
      if (original) Object.defineProperty(document, 'elementFromPoint', original)
      else Reflect.deleteProperty(document, 'elementFromPoint')
    }
  })
})
