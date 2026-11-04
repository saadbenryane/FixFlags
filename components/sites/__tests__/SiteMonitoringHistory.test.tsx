import { act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SiteMonitoringHistory } from '../SiteMonitoringHistory'

describe('monitoring evidence chart', () => {
  it('opens evidence in its owning workspace while retaining modified native link navigation', () => {
    const open = vi.fn()
    render(<SiteMonitoringHistory points={[]} events={[{ id: 'incident', title: 'Website went offline', time: 'Oct 12', state: 'attention',
      evidenceHref: '/sites/site-1#category-uptime', evidenceLabel: 'Uptime details', onOpenEvidence: open }]} emptyMessage="No history" />)
    const link = screen.getByRole('link', { name: 'Uptime details' })
    expect(link).toHaveAttribute('href', '/sites/site-1#category-uptime')
    for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true })
      link.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(link)
    expect(open).toHaveBeenCalledExactlyOnceWith(link)
  })

  it('keeps the incident destination while opening timeline evidence in place', () => {
    const open = vi.fn()
    render(<SiteMonitoringHistory points={[]} events={[
      { id: 'check-1', title: 'Check completed', time: 'Oct 12', state: 'attention', flags: [
        { id: 'incident-1', title: 'Pricing unavailable', href: '/sites/site-1/flags/incident-1', onOpen: open },
      ] },
    ]} emptyMessage="No history" />)
    const target = screen.getByRole('link', { name: 'Pricing unavailable' })
    expect(target).toHaveAttribute('href', '/sites/site-1/flags/incident-1')
    fireEvent.click(target)
    expect(open).toHaveBeenCalledExactlyOnceWith(target)
  })

  it('shows the Overview trend without duplicating the latest count or timeline', () => {
    render(<SiteMonitoringHistory variant="overview" points={[{ label: 'Oct 11', flagCount: 2 }, { label: 'Oct 12', flagCount: 1 }]} events={[
      { id: 'one', title: 'Check completed', time: 'Oct 12', state: 'attention' },
    ]} emptyMessage="No history" />)
    expect(screen.getByRole('img')).toHaveAccessibleDescription('Oct 11: 2 Flags; Oct 12: 1 Flag')
    expect(screen.queryByText(/Latest website check/)).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Check history' })).not.toBeInTheDocument()
  })

  it('leaves a gap between complete checks when evidence is incomplete', () => {
    render(<SiteMonitoringHistory points={[
      { label: 'Oct 8', flagCount: 3 }, { label: 'Oct 9', flagCount: 2 },
      { label: 'Oct 10', flagCount: null },
      { label: 'Oct 11', flagCount: 1 }, { label: 'Oct 12', flagCount: 0 },
    ]} events={[]} emptyMessage="No history" />)
    const chart = screen.getByRole('img', { name: 'Flag count across 5 checks' })
    expect(chart).toHaveAccessibleDescription('Oct 8: 3 Flags; Oct 9: 2 Flags; Oct 10: Check incomplete; Oct 11: 1 Flag; Oct 12: 0 Flags')
    const lines = [...chart.querySelectorAll('polyline')]
    expect(lines).toHaveLength(2)
    expect(lines.every(line => line.getAttribute('points')?.split(' ').length === 2)).toBe(true)
    expect(chart.querySelectorAll('polygon')).toHaveLength(2)
    expect(screen.getByText('Incomplete checks leave a gap. They do not count as zero Flags.')).toBeVisible()
  })

  it('reports an incomplete latest check without replacing it with zero', () => {
    render(<SiteMonitoringHistory points={[{ label: 'Oct 11', flagCount: 2 }, { label: 'Oct 12', flagCount: null }]} events={[]} emptyMessage="No history" />)
    expect(screen.getByText('Check incomplete')).toBeVisible()
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleDescription('Oct 11: 2 Flags; Oct 12: Check incomplete')
  })

  it('shows one completed observation and preserves timeline evidence links', () => {
    render(<SiteMonitoringHistory points={[{ label: 'Oct 12', flagCount: 1 }]} events={[
      { id: 'one', title: 'Check completed', time: 'Oct 12', dateTime: '2026-10-12T09:00:00Z', state: 'attention', flagCount: 1, flags: [{ id: 'flag-1', title: 'Pricing page failed', href: '/sites/site-1/flags/flag-1' }] },
    ]} emptyMessage="No history" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('1 Flag', { selector: 'strong' })).toBeVisible()
    expect(screen.getByText('Latest website check · Oct 12')).toBeVisible()
    expect(screen.getByText(/Your first website check is the starting point/)).toBeVisible()
    const timeline = screen.getByRole('list', { name: 'Check history' })
    expect(within(timeline).getByRole('link', { name: 'Pricing page failed' })).toHaveAttribute('href', '/sites/site-1/flags/flag-1')
  })

  it('explains a first check with no Flags without implying full coverage', () => {
    render(<SiteMonitoringHistory points={[{ label: 'Oct 12', flagCount: 0 }]} events={[]} emptyMessage="No history" />)
    expect(screen.getByText('0 Flags')).toBeVisible()
    expect(screen.getByText(/Your first website check is the starting point/)).toBeVisible()
    expect(screen.getByText(/Read the results for any areas that could not be checked/)).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('explains incomplete history without drawing a zero trend', () => {
    render(<SiteMonitoringHistory points={[{ label: 'Oct 11', flagCount: null }, { label: 'Oct 12', flagCount: null }]} events={[
      { id: 'failed', title: 'Check incomplete', time: 'Oct 12', state: 'unknown' },
    ]} emptyMessage="No history" />)
    expect(screen.getByText('A trend needs complete check results.')).toBeVisible()
    expect(screen.queryByText('0 Flags')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Check history' })).toBeVisible()
  })

  it('draws a visible flat trend when completed checks have zero Flags', () => {
    render(<SiteMonitoringHistory points={[{ label: 'Oct 11', flagCount: 0 }, { label: 'Oct 12', flagCount: 0 }]} events={[]} emptyMessage="No history" />)
    const chart = screen.getByRole('img', { name: 'Flag count across 2 checks' })
    expect(chart).toHaveAccessibleDescription('Oct 11: 0 Flags; Oct 12: 0 Flags')
    expect(chart.querySelectorAll('polyline')).toHaveLength(1)
    expect([...chart.querySelectorAll('text[data-count-label]')].map(label => label.textContent)).toEqual(['0', '0'])
    expect(screen.getByText(/Read the results for any areas that could not be checked/)).toBeVisible()
  })

  it('shows the empty state only when neither history nor events exist', () => {
    render(<SiteMonitoringHistory points={[]} events={[]} emptyMessage="No history" />)
    expect(screen.getByText('No history')).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('explains why checks of individual actions do not make a website-wide trend', () => {
    render(<SiteMonitoringHistory points={[]} events={[
      { id: 'checkout', title: 'Check after a fix', time: 'Oct 12', state: 'healthy' },
    ]} emptyMessage="No history" />)
    expect(screen.getByText(/A website-wide check will start this trend/)).toBeVisible()
    expect(screen.getByRole('list', { name: 'Check history' })).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('No history')).not.toBeInTheDocument()
  })
})

it('hydrates chart descriptions and per-point titles without replacing the server content', async () => {
  const content = <SiteMonitoringHistory points={[{ label: 'Oct 11', flagCount: 2 }, { label: 'Oct 12', flagCount: 0 }]} events={[]} emptyMessage="No history" />
  const container = document.createElement('div'); document.body.append(container)
  container.innerHTML = renderToString(content)
  const errors: unknown[] = []
  let root: ReturnType<typeof hydrateRoot>
  await act(async () => { root = hydrateRoot(container, content, { onRecoverableError: error => errors.push(error) }) })
  try { expect(errors).toEqual([]) } finally { await act(async () => root!.unmount()); container.remove() }
})
