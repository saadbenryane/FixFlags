import { act, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useFocusYield } from '../useFocusYield'

const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top } as DOMRect)
function Fixture({ notifications = false }: { notifications?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  useFocusYield(ref, notifications ? '[data-visible="true"]' : undefined)
  return <><button>Background action</button>
    <section ref={ref} data-testid="overlay" aria-live={notifications ? 'polite' : undefined}>
      <button data-visible="true">Floating action</button>
    </section>
  </>
}

describe('floating surfaces yield to focus', () => {
  it('exposes an overlapping background target immediately and restores the overlay when focus enters it', () => {
    render(<Fixture />)
    const target = screen.getByRole('button', { name: 'Background action' }), overlay = screen.getByTestId('overlay')
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(box(100, 100, 180, 144))
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue(box(120, 110, 190, 160))
    act(() => target.focus())
    expect(overlay).toHaveAttribute('data-yielding-to-focus', 'true')
    expect(target).toHaveFocus()
    expect(overlay).not.toHaveAttribute('hidden')
    act(() => screen.getByRole('button', { name: 'Floating action' }).focus())
    expect(overlay).not.toHaveAttribute('data-yielding-to-focus')
    expect(screen.getByRole('button', { name: 'Floating action' })).toHaveFocus()
  })

  it('responds to viewport movement without moving or stealing focus', () => {
    render(<Fixture />)
    const target = screen.getByRole('button', { name: 'Background action' }), overlay = screen.getByTestId('overlay')
    let obstacle = box(200, 200, 260, 260)
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(box(100, 100, 180, 144))
    vi.spyOn(overlay, 'getBoundingClientRect').mockImplementation(() => obstacle)
    act(() => target.focus())
    expect(overlay).not.toHaveAttribute('data-yielding-to-focus')
    obstacle = box(100, 100, 180, 144)
    act(() => window.dispatchEvent(new Event('scroll')))
    expect(overlay).toHaveAttribute('data-yielding-to-focus', 'true')
    obstacle = box(200, 200, 260, 260)
    act(() => window.dispatchEvent(new Event('resize')))
    expect(overlay).not.toHaveAttribute('data-yielding-to-focus')
    expect(target).toHaveFocus()
  })

  it('uses only active notification geometry and retains the live region', async () => {
    render(<Fixture notifications />)
    const target = screen.getByRole('button', { name: 'Background action' }), overlay = screen.getByTestId('overlay')
    const notification = screen.getByRole('button', { name: 'Floating action' })
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(box(100, 100, 180, 144))
    vi.spyOn(notification, 'getBoundingClientRect').mockReturnValue(box(100, 100, 180, 144))
    act(() => target.focus())
    expect(overlay).toHaveAttribute('data-yielding-to-focus', 'true')
    expect(overlay).toHaveAttribute('aria-live', 'polite')
    expect(overlay).not.toHaveAttribute('aria-hidden')
    notification.setAttribute('data-visible', 'false')
    await waitFor(() => expect(overlay).not.toHaveAttribute('data-yielding-to-focus'))
    expect(target).toHaveFocus()
  })
})
