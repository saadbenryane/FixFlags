import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import GuidesPage, { metadata } from '../page'
import GuidePage, { generateMetadata, generateStaticParams } from '../[slug]/page'
import { GUIDE_REVIEWED_AT, GUIDES_PAGE, WEBSITE_GUIDES } from '@/lib/marketing/copy/guides'

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))

describe('website buyer guides', () => {
  it('makes every guide reachable from the server-rendered index', () => {
    render(<GuidesPage />)
    expect(screen.getByRole('heading', { level: 1, name: GUIDES_PAGE.title })).toBeInTheDocument()
    for (const guide of WEBSITE_GUIDES) {
      expect(screen.getByRole('link', { name: guide.title })).toHaveAttribute('href', `/guides/${guide.slug}`)
    }
    expect(metadata.alternates?.canonical).toContain('/guides')
    expect(generateStaticParams()).toEqual(WEBSITE_GUIDES.map(guide => ({ slug: guide.slug })))
  })

  it('renders complete readable evidence with source links and next steps', async () => {
    for (const guide of WEBSITE_GUIDES) {
      const props = { params: Promise.resolve({ slug: guide.slug }) }
      const view = render(await GuidePage(props))
      expect(screen.getByRole('heading', { level: 1, name: guide.title })).toBeInTheDocument()
      expect(screen.getByText(guide.decision)).toBeInTheDocument()
      const nav = within(screen.getByRole('navigation', { name: GUIDES_PAGE.contents }))
      for (const section of guide.sections) {
        expect(nav.getByRole('link', { name: section.title })).toHaveAttribute('href', `#${section.id}`)
        expect(document.getElementById(section.id)).toHaveTextContent(section.paragraphs[0])
      }
      expect(screen.getByText(GUIDES_PAGE.exampleLabel)).toBeInTheDocument()
      expect(screen.getByText(GUIDE_REVIEWED_AT)).toHaveAttribute('dateTime', GUIDE_REVIEWED_AT)
      for (const source of guide.sources) {
        expect(screen.getAllByRole('link', { name: source.title }).every(link => link.getAttribute('href') === source.href)).toBe(true)
        expect(screen.getByText(source.supports)).toBeInTheDocument()
      }
      expect(screen.getByRole('link', { name: GUIDES_PAGE.start })).toHaveAttribute('href', '/new')
      expect(screen.getByRole('link', { name: GUIDES_PAGE.pricing })).toHaveAttribute('href', '/pricing')
      expect((await generateMetadata(props)).alternates?.canonical).toContain(`/guides/${guide.slug}`)
      const schema = JSON.parse(view.container.querySelector('script[type="application/ld+json"]')!.textContent!)
      expect(schema['@graph'][0]['@type']).toBe('Article')
      view.unmount()
    }
  })

  it('does not render or index unknown guide slugs', async () => {
    const props = { params: Promise.resolve({ slug: 'not-a-guide' }) }
    await expect(GuidePage(props)).rejects.toThrow('NOT_FOUND')
    await expect(generateMetadata(props)).rejects.toThrow('NOT_FOUND')
  })
})
