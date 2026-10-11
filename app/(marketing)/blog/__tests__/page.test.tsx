import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BlogPage from '../page'
import BlogPostPage, { generateMetadata, generateStaticParams } from '../[slug]/page'
import { BLOG_PAGE, BLOG_POSTS } from '@/lib/marketing/copy/blog'
import { getDocsPage } from '@/lib/docs/catalog'
import ChangelogPage from '@/app/(marketing)/changelog/page'
import { CHANGELOG_ENTRIES } from '@/lib/marketing/copy/faq'

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('@/components/marketing/MarketingPageViewTracker', () => ({ MarketingPageViewTracker: () => null }))

describe('public editorial pages', () => {
  it('makes each article discoverable with its own next step', () => {
    render(<BlogPage />)
    expect(screen.getByRole('heading', { level: 1, name: BLOG_PAGE.headline })).toBeInTheDocument()
    for (const post of BLOG_POSTS) {
      expect(screen.getByRole('link', { name: post.title })).toHaveAttribute('href', `/blog/${post.slug}`)
      expect(screen.getByRole('link', { name: `${BLOG_PAGE.readArticle}: ${post.title}` })).toHaveAttribute('href', `/blog/${post.slug}`)
    }
    expect(screen.getByRole('link', { name: /Read the docs/ })).toHaveAttribute('href', '/docs')
    expect(screen.getByRole('link', { name: /Check your website/ })).toHaveAttribute('href', '/new')
    expect(generateStaticParams()).toHaveLength(BLOG_POSTS.length)
  })

  it('renders complete articles with working section anchors and related guides', async () => {
    for (const post of BLOG_POSTS) {
      const props = { params: Promise.resolve({ slug: post.slug }) }
      const view = render(await BlogPostPage(props))
      expect(screen.getByRole('heading', { level: 1, name: post.title })).toBeInTheDocument()
      const contents = within(screen.getByRole('navigation', { name: BLOG_PAGE.onThisPage }))
      for (const section of post.sections) {
        expect(contents.getByRole('link', { name: section.title })).toHaveAttribute('href', `#${section.id}`)
        expect(document.getElementById(section.id)).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: section.title })).toBeInTheDocument()
      }
      for (const key of post.relatedDocs) {
        const guide = getDocsPage(key)
        expect(screen.getByRole('link', { name: `${guide.title} →` })).toHaveAttribute('href', guide.path)
      }
      expect((await generateMetadata(props)).alternates?.canonical).toContain(`/blog/${post.slug}`)
      const jsonLd = JSON.parse(view.container.querySelector('script[type="application/ld+json"]')!.textContent!)
      expect(jsonLd['@graph'].find((item: { '@type': string }) => item['@type'] === 'BlogPosting')).toMatchObject({ datePublished: post.publishedAt ?? post.date, ...(post.updatedAt ? { dateModified: post.updatedAt } : {}), image: expect.objectContaining({ url: expect.stringContaining(post.cover.src) }) })
      expect(screen.getByRole('img', { name: post.cover.alt })).toBeInTheDocument()
      expect(screen.getByRole('progressbar', { name: BLOG_PAGE.readingProgress })).toBeInTheDocument()
      if (post.dateNote) expect(screen.getByText(post.dateNote)).toBeInTheDocument()
      view.unmount()
    }
    await expect(BlogPostPage({ params: Promise.resolve({ slug: 'missing' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('starts the series with the founding story and keeps its origin and publication dates distinct', () => {
    expect(BLOG_POSTS[0]).toMatchObject({ slug: 'introducing-fixflags', date: '2026-06-10', publishedAt: '2026-10-11' })
    render(<BlogPage />)
    const firstArticle = screen.getAllByRole('article')[0]
    expect(within(firstArticle).getByRole('heading', { name: BLOG_POSTS[0].title })).toBeInTheDocument()
    expect(within(firstArticle).getByRole('img')).toHaveAttribute('alt', BLOG_POSTS[0].cover.alt)
  })

  it('shows the latest shipped documentation update in the changelog', () => {
    render(<ChangelogPage />)
    expect(screen.getByRole('heading', { name: CHANGELOG_ENTRIES[0].title })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explore the documentation' })).toHaveAttribute('href', '/docs')
  })
})
