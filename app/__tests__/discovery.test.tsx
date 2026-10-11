import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import RootLayout from '@/app/layout'

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
})
