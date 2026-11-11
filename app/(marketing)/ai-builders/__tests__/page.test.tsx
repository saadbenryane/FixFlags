import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AiBuildersPage, { metadata } from '../page'
import AiBuilderToolPage, { generateMetadata, generateStaticParams } from '../[tool]/page'
import { AI_BUILDERS_PAGE as C, AI_BUILDER_TOOLS, aiBuilderExamplePrompt } from '@/lib/marketing/copy/ai-builders'
import { INDEXABLE_ROUTES } from '@/lib/marketing/seo-routes'
import { MARKETING_LINKS } from '@/lib/site/nav'

vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))
vi.mock('@/components/audit/AuditInput', () => ({ AuditInput: () => <div data-testid="url-entry" /> }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND') } }))

afterEach(() => { vi.unstubAllGlobals() })

describe('For AI builders', () => {
  it('is in the main navigation and lists every tool page', () => {
    expect(MARKETING_LINKS).toContainEqual({ href: '/ai-builders', label: 'For AI builders' })
    expect(INDEXABLE_ROUTES.some(route => route.path === '/ai-builders')).toBe(true)
    expect(metadata.alternates?.canonical).toMatch(/\/ai-builders$/)
    render(<AiBuildersPage />)
    expect(screen.getByRole('heading', { level: 1, name: C.title })).toBeVisible()
    for (const tool of AI_BUILDER_TOOLS) expect(screen.getByRole('link', { name: new RegExp(C.open(tool.name)) })).toHaveAttribute('href', `/ai-builders/${tool.slug}`)
    for (const step of C.loop) expect(screen.getByRole('heading', { name: step.title })).toBeVisible()
  })

  it('builds one indexable page per tool with steps, an example, and links to the others', async () => {
    expect(generateStaticParams().map(param => param.tool)).toEqual(AI_BUILDER_TOOLS.map(tool => tool.slug))
    const tool = AI_BUILDER_TOOLS.find(item => item.slug === 'lovable')!
    const meta = await generateMetadata({ params: Promise.resolve({ tool: 'lovable' }) })
    expect(meta.alternates?.canonical).toMatch(/\/ai-builders\/lovable$/)
    render(await AiBuilderToolPage({ params: Promise.resolve({ tool: 'lovable' }) }))
    expect(screen.getByRole('heading', { level: 1, name: C.tool.title('Lovable') })).toBeVisible()
    expect(screen.getByTestId('url-entry')).toBeInTheDocument()
    expect(screen.getByText(tool.where)).toBeVisible()
    expect(screen.getByText(aiBuilderExamplePrompt(tool), { normalizer: text => text })).toBeVisible()
    const others = screen.getByRole('navigation', { name: C.tool.other })
    expect(within(others).getAllByRole('link')).toHaveLength(AI_BUILDER_TOOLS.length - 1)
    expect(screen.queryByRole('link', { name: C.tool.mcp.action })).not.toBeInTheDocument()
    await expect(AiBuilderToolPage({ params: Promise.resolve({ tool: 'unknown' }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })

  it('copies the example and falls back to selectable text', async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValueOnce(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(await AiBuilderToolPage({ params: Promise.resolve({ tool: 'cursor' }) }))
    fireEvent.click(screen.getByRole('button', { name: C.tool.copy }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: C.tool.exampleTitle })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: C.tool.copy }))
    expect(await screen.findByRole('status')).toHaveTextContent(C.tool.copied)
  })

  it('points coding agents, and only coding agents, to the MCP connection', async () => {
    for (const tool of AI_BUILDER_TOOLS) {
      const { unmount } = render(await AiBuilderToolPage({ params: Promise.resolve({ tool: tool.slug }) }))
      const link = screen.queryByRole('link', { name: C.tool.mcp.action })
      if (tool.kind === 'agent') expect(link).toHaveAttribute('href', '/connect-ai')
      else expect(link).not.toBeInTheDocument()
      unmount()
    }
    expect(AI_BUILDER_TOOLS.filter(tool => tool.kind === 'agent').map(tool => tool.slug)).toEqual(['cursor', 'claude-code'])
  })

  it('keeps MCP to its one pointer and the copy free of em dashes', () => {
    const text = JSON.stringify(AI_BUILDERS_PAGE_TEXT())
    expect(text).not.toMatch(/\u2014/)
    expect(text).not.toMatch(/\bMCP\b|coming soon|about a minute/i)
  })
})

function AI_BUILDERS_PAGE_TEXT() {
  return { page: { ...C, tool: Object.fromEntries(Object.entries(C.tool).filter(([key]) => key !== 'mcp')), seo: C.seo.description }, tools: AI_BUILDER_TOOLS.map(tool => ({ ...tool, prompt: aiBuilderExamplePrompt(tool), steps: C.tool.steps(tool) })) }
}
