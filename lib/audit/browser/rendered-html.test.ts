// @vitest-environment jsdom
import type { Page } from 'playwright'
import { beforeEach, describe, expect, it } from 'vitest'
import { collectRenderedHtml, RENDERED_HTML_LIMIT } from './rendered-html'
import { parseMetadataFromHtml } from '../metadata'

const page = { evaluate: async (fn: (input: unknown) => unknown, input: unknown) => fn(input) } as unknown as Page
beforeEach(() => {
  for (const attribute of [...document.documentElement.attributes]) document.documentElement.removeAttribute(attribute.name)
  document.documentElement.innerHTML = '<head></head><body></body>'
})

describe('bounded rendered DOM metadata input', () => {
  it('keeps an ordinary rendered document unchanged', async () => {
    document.head.innerHTML = '<title>Useful website</title>'
    document.body.innerHTML = '<h1>Useful website</h1><a href="/pricing">Pricing</a>'
    const original = document.documentElement.outerHTML
    expect(await collectRenderedHtml(page)).toMatchObject({ html: original, compacted: false, truncated: false })
  })

  it('preserves all parsed metadata while compacting implementation and hydration text', async () => {
    document.documentElement.setAttribute('lang', 'en')
    document.documentElement.setAttribute('dir', 'ltr')
    document.head.innerHTML = '<title>Useful website</title><meta name="viewport" content="width=device-width">' +
      '<style>button { border: 1px solid blue }</style><script src="http://cdn.example.com/app.js"></script>' +
      '<script type="application/ld+json">{"@type":"Organization","email":"support@example.com"}</script>' +
      '<script type="application/json">' + JSON.stringify({ data: 'x'.repeat(RENDERED_HTML_LIMIT), tool: 'googletagmanager', consent: 'cookiebot' }) + '</script>'
    document.body.innerHTML = '<h1>Useful website</h1><a href="/privacy">Privacy policy</a><a href="mailto:support@example.com">Contact</a>' +
      '<form><label for="email">Email</label><input id="email" type="email" required><button>Sign up<script type="application/json">{"label":"retained nested data"}</script></button></form><img src="/hero.png" alt="Useful illustration">'
    const original = document.documentElement.outerHTML
    const collected = await collectRenderedHtml(page)
    expect(collected).toMatchObject({ compacted: true, truncated: false })
    expect(new TextEncoder().encode(collected.html!).byteLength).toBeLessThan(RENDERED_HTML_LIMIT)
    expect(parseMetadataFromHtml(collected.html!, collected.finalUrl)).toEqual(parseMetadataFromHtml(original, collected.finalUrl))
    expect(collected.html).toContain('application/ld+json')
    expect(document.documentElement.outerHTML).toBe(original)
  })

  it('does not execute custom-element constructors while collecting compact evidence', async () => {
    let constructed = 0
    const name = 'snapshot-widget-' + Math.random().toString(36).slice(2)
    customElements.define(name, class extends HTMLElement { constructor() { super(); constructed++ } })
    document.body.innerHTML = '<' + name + '>Useful content</' + name + '><script>' + '/*' + 'x'.repeat(RENDERED_HTML_LIMIT) + '*/</script>'
    expect(constructed).toBe(1)
    expect(await collectRenderedHtml(page)).toMatchObject({ compacted: true, truncated: false })
    expect(constructed).toBe(1)
  })

  it('retains unknown scope when the DOM itself exceeds the byte budget', async () => {
    document.body.innerHTML = '<p>' + '界'.repeat(400_000) + '</p>'
    expect(await collectRenderedHtml(page)).toMatchObject({ html: null, compacted: false, truncated: true })
  })

  it('preserves nested script text that could affect existing element-text detection', async () => {
    document.body.innerHTML = '<button><script type="application/json">' + JSON.stringify({ value: 'x'.repeat(RENDERED_HTML_LIMIT) }) + '</script></button>'
    expect(await collectRenderedHtml(page)).toMatchObject({ html: null, truncated: true })
  })

  it('does not compact structured data required by the metadata evaluator', async () => {
    document.head.innerHTML = '<script type="application/ld+json">' + JSON.stringify({ '@type': 'Organization', description: 'x'.repeat(RENDERED_HTML_LIMIT) }) + '</script>'
    expect(await collectRenderedHtml(page)).toMatchObject({ html: null, truncated: true })
  })
})
