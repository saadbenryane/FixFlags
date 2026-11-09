import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import RootLayout from '@/app/layout'

// Next's compiler supplies font classes. Real loading is checked by font:verify.
vi.mock('next/font/local', () => ({ default: ({ variable }: { variable: string }) => ({ variable }) }))

vi.mock('@/components/providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/analytics/ConversionScripts', () => ({
  ConversionScripts: () => null,
}))

describe('server-rendered discovery', () => {
  it('advertises llms.txt in the document head before client JavaScript runs', () => {
    const html = renderToStaticMarkup(<RootLayout><main id="main-content">Website content</main></RootLayout>)
    const document = new DOMParser().parseFromString(html, 'text/html')
    const links = document.head.querySelectorAll('link[rel="describedby"]')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/llms.txt')
    expect(links[0].getAttribute('type')).toBe('text/plain')
    expect(document.querySelector('main')?.textContent).toBe('Website content')
  })

  it('provides finite path labels in the initial document only for controlled Google pageviews', () => {
    const renderPaths = () => new DOMParser().parseFromString(
      renderToStaticMarkup(<RootLayout><main id="main-content">Website content</main></RootLayout>), 'text/html',
    ).body.dataset.gaPublicPaths
    try {
      vi.stubEnv('NEXT_PUBLIC_GA_PAGEVIEW_MODE', 'automatic')
      expect(renderPaths()).toBeUndefined()
      vi.stubEnv('NEXT_PUBLIC_GA_PAGEVIEW_MODE', 'controlled')
      const paths = renderPaths()?.split(' ')
      expect(paths).toEqual(expect.arrayContaining(['/', '/guides/website-online-but-not-working', '/new', '/post-login']))
      expect(paths?.every(path => !/^\/(sites|report|share|admin)(\/|$)/.test(path))).toBe(true)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
