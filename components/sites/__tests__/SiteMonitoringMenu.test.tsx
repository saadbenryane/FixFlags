import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SiteMonitoringMenu } from '../SiteMonitoringMenu'

afterEach(() => vi.restoreAllMocks())

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({ left, top, width, height }) }
}

describe('monitoring panel placement', () => {
  it('stays within narrow content and opens above a trigger near the bottom of the screen', () => {
    render(<div data-site-content><SiteMonitoringMenu label="Every 3 hours" state="healthy" nextCheck="Next check in 2 hours" /></div>)
    const trigger = screen.getByRole('button', { name: 'Monitoring: Every 3 hours' })
    const content = trigger.closest('[data-site-content]')
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(320)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(780)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this === content) return rect(16, 0, 288, 780)
      if (this === trigger.parentElement) return rect(16, 700, 164, 44)
      if (this.getAttribute('role') === 'region') return rect(0, 0, 240, 120)
      return rect(0, 0, 0, 0)
    })
    fireEvent.click(trigger)
    const panel = screen.getByRole('region', { name: 'Monitoring' })
    const left = 16 + Number.parseFloat(panel.style.left)
    expect(left).toBeGreaterThanOrEqual(16)
    expect(left + Number.parseFloat(panel.style.width)).toBeLessThanOrEqual(304)
    expect(Number.parseFloat(panel.style.top)).toBeLessThan(0)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })
})
