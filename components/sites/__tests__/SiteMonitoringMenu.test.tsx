import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SiteMonitoringMenu } from '../SiteMonitoringMenu'
import { nextCheckLabel } from '@/lib/sites/monitoring-schedule'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({ left, top, width, height }) }
}

describe('monitoring panel placement', () => {
  it('keeps monitoring settings behind an explicit customer navigation', () => {
    render(<SiteMonitoringMenu label="Off" state="unknown" nextCheck="No monitoring schedule" manageHref="/sites/example/settings#watch" />)
    expect(screen.queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Monitoring: Off' }))
    expect(screen.getByRole('link')).toHaveAttribute('href', '/sites/example/settings#watch')
  })
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

  it('repositions growing monitoring details without waiting for a window resize', () => {
    let resize: ResizeObserverCallback = () => {}
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: ResizeObserverCallback) { resize = callback }
      observe() {}
      disconnect() {}
    })
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(500)
    let height = 80
    render(<SiteMonitoringMenu label="Every 3 hours" state="healthy" nextCheck="Next check in 2 hours" />)
    const trigger = screen.getByRole('button', { name: 'Monitoring: Every 3 hours' })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this === trigger.parentElement ? rect(20, 300, 164, 44) : this.getAttribute('role') === 'region' ? rect(0, 0, 240, height) : rect(0, 0, 0, 0)
    })
    fireEvent.click(trigger)
    height = 180
    act(() => resize([], {} as ResizeObserver))
    const panel = screen.getByRole('region', { name: 'Monitoring' })
    expect(300 + Number.parseFloat(panel.style.top) + height).toBeLessThanOrEqual(292)
  })

  it('bounds monitoring details to a resized and offset visual viewport', () => {
    const viewport = Object.assign(new EventTarget(), { width: 320, height: 600, offsetLeft: 100, offsetTop: 80 })
    vi.stubGlobal('visualViewport', viewport)
    render(<SiteMonitoringMenu label="Every 3 hours" state="healthy" nextCheck="Next check in 2 hours" />)
    const trigger = screen.getByRole('button', { name: 'Monitoring: Every 3 hours' })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this === trigger.parentElement ? rect(120, 180, 164, 44) : this.getAttribute('role') === 'region' ? rect(0, 0, 240, 160) : rect(0, 0, 0, 0)
    })
    fireEvent.click(trigger)
    viewport.height = 280
    act(() => viewport.dispatchEvent(new Event('resize')))
    const panel = screen.getByRole('region', { name: 'Monitoring' })
    const left = 120 + Number.parseFloat(panel.style.left)
    expect(left).toBeGreaterThanOrEqual(116)
    expect(left + Number.parseFloat(panel.style.width)).toBeLessThanOrEqual(404)
    const top = 180 + Number.parseFloat(panel.style.top)
    expect(top).toBeGreaterThanOrEqual(96)
    expect(top + Number.parseFloat(panel.style.maxHeight)).toBeLessThanOrEqual(344)
    viewport.offsetTop = 0
    act(() => viewport.dispatchEvent(new Event('scroll')))
    expect(180 + Number.parseFloat(panel.style.top)).toBe(16)
    expect(Number.parseFloat(panel.style.maxHeight)).toBe(156)
  })

  it('dismisses details when scrolling their anchor out of view and retires viewport observers', () => {
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class { observe() {}; disconnect = disconnect })
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(500)
    let anchorTop = 100
    render(<SiteMonitoringMenu label="Every 3 hours" state="healthy" nextCheck="Next check in 2 hours" manageHref="/sites/example/settings#watch" />)
    const trigger = screen.getByRole('button', { name: 'Monitoring: Every 3 hours' })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this === trigger.parentElement ? rect(20, anchorTop, 164, 44) : this.getAttribute('role') === 'region' ? rect(0, 0, 240, 120) : rect(0, 0, 0, 0)
    })
    fireEvent.click(trigger)
    screen.getByRole('link').focus()
    const retired = disconnect.mock.calls.length
    anchorTop = -80
    fireEvent.scroll(window)
    expect(screen.queryByRole('region', { name: 'Monitoring' })).toBeNull()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    expect(disconnect.mock.calls.length).toBeGreaterThan(retired)
  })
})

it('keeps an open countdown current without reading the Site or keeping a closed timer', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-03T12:00:00Z'))
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  const nextRunAt = '2026-11-03T12:02:00Z'
  const rendered = render(<SiteMonitoringMenu label="Every 3 hours" state="healthy" nextCheck={now => nextCheckLabel(nextRunAt, now)} />)
  try {
    expect(vi.getTimerCount()).toBe(0)
    const trigger = screen.getByRole('button', { name: 'Monitoring: Every 3 hours' })
    fireEvent.click(trigger)
    expect(screen.getByText('Next check in 2 minutes')).toBeVisible()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('Next check in 1 minute')).toBeVisible()
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('Next check due now')).toBeVisible()
    expect(vi.getTimerCount()).toBe(1)
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(trigger)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    rendered.unmount()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  }
})

it('keeps authored monitoring previews fixed without a clock subscription', () => {
  vi.useFakeTimers()
  const rendered = render(<SiteMonitoringMenu label="Every 3 hours" state="healthy" nextCheck="Next check in 2 hours" />)
  try {
    fireEvent.click(screen.getByRole('button', { name: 'Monitoring: Every 3 hours' }))
    expect(vi.getTimerCount()).toBe(0)
    act(() => vi.advanceTimersByTime(60_000))
    expect(screen.getByText('Next check in 2 hours')).toBeVisible()
  } finally {
    rendered.unmount()
    vi.useRealTimers()
  }
})
