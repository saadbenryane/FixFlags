import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import type { ReportWorkspaceCapabilities } from '@/lib/report/workspace-model'

const values = new Map<string, string>()
vi.mock('next/navigation', () => ({
  usePathname: () => '/report/a1',
  useSearchParams: () => ({ get: (key: string) => values.get(key) ?? null }),
}))

const capabilities: ReportWorkspaceCapabilities = { promptAccess: 'all', canCopyPrompts: true, canReplayTimeline: true, canChat: true, canUseCanvas: true, canShare: true, canExport: true, canRecheck: true, canGiveFeedback: true, demonstratedFlagId: null }

function renderShell(scanning = false) {
  return render(<ReportWorkspaceSplitShell scanning={scanning} leftPanel={<div>Agent content</div>} browserUrl="https://example.com" reportHeader={<div>Score and history</div>} reportPanel={<div>Report content</div>} capabilities={capabilities} />)
}

beforeEach(() => { values.clear(); window.history.replaceState({}, '', '/report/a1') })

describe('ReportWorkspaceSplitShell', () => {
  it('exposes only Agent and Report on mobile', () => {
    renderShell()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Agent', 'Report'])
    expect(screen.queryByRole('tab', { name: /timeline|canvas|preview/i })).not.toBeInTheDocument()
  })

  it('keeps both panes mounted on desktop and defaults completed reviews to Report', () => {
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
