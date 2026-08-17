import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { IntegrationsBlock } from '@/components/marketing/landing/IntegrationsBlock'
import { SampleReportSection } from '@/components/marketing/landing/SampleReportSection'
import { WORKSPACE_SPLIT_GRID_CLASS } from '@/components/report/workspace-geometry'

beforeAll(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    }
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('homepage lean sections', () => {
  it('shows the compact integrations block with MCP and CLI links', () => {
    render(<IntegrationsBlock />)

    expect(screen.getByText((content) => content.includes('Works in the editor you already use'))).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Set up MCP' })).toHaveAttribute(
      'href',
      '/docs/integrations#quick-start'
    )
    expect(screen.getByRole('link', { name: 'CLI docs' })).toHaveAttribute('href', '/docs/cli')
    expect(screen.getAllByRole('link', { name: /integration guide/i })).toHaveLength(8)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders the shared-model Product review story instead of a flattened screenshot', () => {
    render(<SampleReportSection />)

    const story = screen.getByLabelText('FixFlags review story')
    expect(story).toBeInTheDocument()
    expect(screen.getByText('Launchpad demo')).toBeInTheDocument()
    // The reviewed host names both panes now that no fake browser bar carries it.
    expect(screen.getAllByText('fixflags.com/demo').length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: 'Agent' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Desktop' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mobile' })).toBeInTheDocument()
    expect(screen.getByText(/opening the Product on desktop and mobile/i)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Page screenshot' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review my site' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Explore a full report/i })).toHaveAttribute(
      'href',
      '/samples',
    )
    expect(screen.getByText('199+')).toBeInTheDocument()
    expect(
      screen.queryByAltText(/Generated FixFlags sample Finish Plan/i)
    ).not.toBeInTheDocument()

    const grid = Array.from(story.querySelectorAll('div')).find((node) =>
      node.className.includes(WORKSPACE_SPLIT_GRID_CLASS)
    )
    expect(grid).toBeDefined()
  })

  it('gives the visitor the real Preview and Report toggle instead of decorative pills', () => {
    render(<SampleReportSection />)

    const mobileTabs = screen.getByRole('tablist', { name: 'Review panels' })
    expect(within(mobileTabs).getByRole('tab', { name: 'Preview' })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    fireEvent.click(within(mobileTabs).getByRole('tab', { name: 'Report' }))

    expect(within(mobileTabs).getByRole('tab', { name: 'Report' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByText('Unresolved Flags')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Desktop' })).not.toBeInTheDocument()
  })

  it('shows the complete value story without timed motion for reduced-motion users', async () => {
    vi.mocked(globalThis.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(<SampleReportSection />)

    fireEvent.click(
      within(screen.getByRole('tablist', { name: 'Review panels' })).getByRole('tab', {
        name: 'Report',
      })
    )
    expect(await screen.findByText('Unresolved Flags')).toBeInTheDocument()
    expect(window.location.search).not.toMatch(/flag=/)
  })
})
