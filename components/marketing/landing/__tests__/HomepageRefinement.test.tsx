import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { IntegrationsBlock } from '@/components/marketing/landing/IntegrationsBlock'
import { Footer } from '@/components/layout/footer'
import { LandingFinalCtaSection } from '@/components/marketing/landing/LandingFinalCtaSection'
import { LandingHowItWorksSection } from '@/components/marketing/landing/LandingHowItWorksSection'
import { LandingRubricsSection } from '@/components/marketing/landing/LandingRubricsSection'
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
    })),
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
    },
  )
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('homepage lean sections', () => {
  it('explains Message, Experience, and Reach through customer questions', () => {
    render(<LandingRubricsSection />)

    expect(
      screen.getByRole('heading', {
        name: 'See your product through your users’ eyes',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Do people understand what this is and why it matters?',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Can people do what they came to do?',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'Can people find it and share it clearly?',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: 'Message checks' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: 'Experience checks' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: 'Reach checks' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Example Flag')).not.toBeInTheDocument()
  })

  it('presents How it works as one connected review workflow', () => {
    render(<LandingHowItWorksSection />)

    expect(
      screen.getByRole('heading', {
        name: 'Find the issues. Fix them. See what improved',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(
      screen.getByRole('heading', { name: 'Review the live product' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Fix the most important Flag' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Run an update review' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('FixFlags review')).not.toBeInTheDocument()
  })

  it('shows the URL-first builder workflow without power-tool discovery', () => {
    render(<IntegrationsBlock />)

    expect(
      screen.getByText((content) =>
        content.includes('Start with copy and paste'),
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/run an update review on the live URL/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Read the report guide' })).toHaveAttribute(
      'href',
      '/docs/reports',
    )
    expect(screen.getByRole('link', { name: 'See a sample report' })).toHaveAttribute(
      'href',
      '/samples',
    )
    expect(screen.queryByText(/MCP|CLI/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /integration guide/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('keeps repeated assurances and sample metrics out of the final CTA and footer', () => {
    const { container } = render(
      <>
        <LandingFinalCtaSection />
        <Footer />
      </>,
    )

    const finalCta = container.querySelector('#final-cta')
    const footer = container.querySelector('footer')
    expect(finalCta).not.toBeNull()
    expect(footer).not.toBeNull()
    expect(
      within(finalCta as HTMLElement).queryByText('Evidence from your live site'),
    ).not.toBeInTheDocument()
    expect(
      within(finalCta as HTMLElement).queryByText('3 reviews included free'),
    ).not.toBeInTheDocument()
    expect(
      within(footer as HTMLElement).queryByText('Fix prompt'),
    ).not.toBeInTheDocument()
    expect(
      within(footer as HTMLElement).queryByText('Update review'),
    ).not.toBeInTheDocument()
  })

  it('renders the shared-model Product review story instead of a flattened screenshot', () => {
    render(<SampleReportSection />)

    const story = screen.getByLabelText('FixFlags review story')
    expect(story).toBeInTheDocument()
    expect(screen.getByText('Launchpad demo')).toBeInTheDocument()
    // The reviewed host names both panes now that no fake browser bar carries it.
    expect(screen.getAllByText('fixflags.com/demo').length).toBeGreaterThan(0)
    expect(screen.getByRole('tab', { name: 'Agent' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab', { name: 'Preview' })).not.toHaveLength(0)
    expect(screen.getAllByRole('tab', { name: 'Report' })).not.toHaveLength(0)
    expect(
      screen.getByRole('img', { name: 'Page screenshot' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Review my site' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /Explore a full report/i }),
    ).toHaveLength(1)
    expect(
      screen.getByRole('link', { name: /Explore a full report/i }),
    ).toHaveAttribute('href', '/samples')
    expect(screen.queryByText('199+')).not.toBeInTheDocument()
    expect(screen.queryByText('Flags in this sample')).not.toBeInTheDocument()
    expect(
      screen.queryByAltText(/Generated FixFlags sample Finish Plan/i),
    ).not.toBeInTheDocument()

    const grid = Array.from(story.querySelectorAll('div')).find((node) =>
      node.className.includes(WORKSPACE_SPLIT_GRID_CLASS),
    )
    expect(grid).toBeDefined()
  })

  it('gives the visitor the real Agent, Preview, and Report workspace toggle', () => {
    render(<SampleReportSection />)

    const mobileTabs = screen.getByRole('tablist', { name: 'Review panels' })
    expect(
      within(mobileTabs).getByRole('tab', { name: 'Preview' }),
    ).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(within(mobileTabs).getByRole('tab', { name: 'Agent' }))

    expect(
      within(mobileTabs).getByRole('tab', { name: 'Agent' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(within(mobileTabs).getByRole('tab', { name: 'Report' })).toBeInTheDocument()
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
      within(screen.getByRole('tablist', { name: 'Review panels' })).getByRole(
        'tab',
        {
          name: 'Report',
        },
      ),
    )
    expect(
      screen.queryByRole('tab', { name: 'Desktop' }),
    ).not.toBeInTheDocument()
    expect(window.location.search).not.toMatch(/flag=/)
  })

  it('shows the sample Agent and live Product preview before settling on the report', () => {
    render(<SampleReportSection />)

    expect(screen.getByRole('region', { name: 'Agent' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Page screenshot' })).toBeInTheDocument()
    expect(screen.getAllByRole('tab', { name: 'Preview' })).not.toHaveLength(0)
  })
})
