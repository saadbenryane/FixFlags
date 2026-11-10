import { describe, expect, it, vi } from 'vitest'
import { checkLinks, extractInternalLinks } from '../broken-links'

describe('broken link checker', () => {
  it('keeps unique same-site http links and drops fragments, other sites, credentials and non-web schemes', () => {
    const html = `
      <a href="/pricing">Pricing</a><a href="/pricing#plans">Plans</a><a href="https://shop.com/about"> About   us </a>
      <a href="#top">Top</a><a href="mailto:a@b.c">Mail</a><a href="tel:1">Call</a><a href="javascript:void(0)">x</a>
      <a href="https://other.com/x">Other</a><a href="https://user:pw@shop.com/secret">Secret</a><a href="/">Home</a><a href="//shop.com/blog">Blog</a>`
    expect(extractInternalLinks(html, 'https://shop.com/')).toEqual([
      { url: 'https://shop.com/pricing', text: 'Pricing' },
      { url: 'https://shop.com/about', text: 'About us' },
      { url: 'https://shop.com/blog', text: 'Blog' },
    ])
  })

  it('reports error statuses and unreachable links, keeping order', async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.endsWith('/gone')) return { statusCode: 404 }
      if (url.includes('/down')) throw new Error('timeout')
      return { statusCode: 200 }
    })
    const results = await checkLinks([
      { url: 'https://shop.com/ok', text: 'OK' }, { url: 'https://shop.com/gone', text: 'Gone' }, { url: 'https://shop.com/down?x=1', text: 'Down' },
    ], fetcher)
    expect(results.map(result => [result.path, result.status, result.problem])).toEqual([
      ['/ok', 200, null], ['/gone', 404, 'error_status'], ['/down?x=1', null, 'unreachable'],
    ])
  })
})
