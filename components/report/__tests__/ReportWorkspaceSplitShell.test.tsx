import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'

const values = new Map<string, string>()
vi.mock('next/navigation', () => ({
  usePathname: () => '/report/a1',
  useSearchParams: () => ({
    get: (key: string) => values.get(key) ?? null,
    toString: () => new URLSearchParams([...values]).toString(),
  }),
}))

function renderShell(scanning = false) {
  return render(
    <ReportWorkspaceSplitShell
      scanning={scanning}
      leftPanel={<div>Agent content</div>}
      reportHeader={<div>Score and history</div>}
      reportPanel={<div>Report content</div>}
    />
  )
}

beforeEach(() => {
  values.clear()
  window.history.replaceState({}, '', '/report/a1')
})

describe('ReportWorkspaceSplitShell', () => {
  it('exposes only Agent and Report with icons', () => {
    renderShell()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Agent', 'Report'])
    const agent = screen.getByRole('tab', { name: 'Agent' })
    const report = screen.getByRole('tab', { name: 'Report' })
    expect(agent.querySelector('svg')).not.toBeNull()
    expect(report.querySelector('svg')).not.toBeNull()
    expect(screen.queryByRole('tab', { name: /timeline|canvas|preview/i })).not.toBeInTheDocument()
  })

  it('keeps both panes mounted and defaults completed reviews to Report', () => {
    renderShell()
    expect(screen.getByText('Agent content')).toBeInTheDocument()
    expect(screen.getByText('Report content')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Report' })).toHaveAttribute('aria-selected', 'true')
  })

  it('defaults active mobile reviews to Agent and switches to Report', () => {
    renderShell(true)
    const report = screen.getByRole('tab', { name: 'Report' })
    expect(screen.getByRole('tab', { name: 'Agent' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(report)
    expect(report).toHaveAttribute('aria-selected', 'true')
  })

  it('normalizes legacy Timeline and Canvas view parameters to Report', async () => {
    values.set('view', 'timeline')
    window.history.replaceState({}, '', '/report/a1?view=timeline')
    renderShell()
    await waitFor(() => expect(window.location.search).toBe('?view=report'))
  })
})
