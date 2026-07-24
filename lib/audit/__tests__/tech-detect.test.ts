import { describe, expect, it } from 'vitest'
import {
  TECHNOLOGY_DETECTOR_VERSION,
  detectTechnologies,
  registeredTechnologyKind,
} from '@/lib/audit/tech-detect'
import type { TechnologyResourceRecord } from '@/lib/audit/browser/network-monitor'

function resource(url: string, resourceType = 'script'): TechnologyResourceRecord {
  const parsed = new URL(url)
  return {
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    resourceType,
    status: 200,
  }
}

function names(input: {
  html?: string
  headers?: Record<string, string>
  resources?: TechnologyResourceRecord[]
  runtime?: string[]
}) {
  return detectTechnologies(
    input.html ?? '<html></html>',
    input.headers ?? {},
    input.resources ?? [],
    input.runtime ?? []
  ).map((technology) => technology.name)
}

describe('technology detection', () => {
  it('has a versioned deterministic contract', () => {
    expect(TECHNOLOGY_DETECTOR_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}\.\d+$/)
    expect(registeredTechnologyKind('Shopify')).toBe('commerce')
    expect(registeredTechnologyKind('Cursor')).toBeNull()
    expect(registeredTechnologyKind('Meta Pixel')).toBeNull()
  })

  it.each([
    ['Next.js', { resources: [resource('https://site.test/_next/static/chunks/app.js')] }],
    ['React', { html: '<main data-reactroot=""></main>' }],
    ['Vue', { html: '<main data-v-app></main>' }],
    ['Nuxt', { resources: [resource('https://site.test/_nuxt/app.123.js')] }],
    ['Angular', { html: '<app-root ng-version="20.0.0"></app-root>' }],
    ['SvelteKit', { resources: [resource('https://site.test/_app/immutable/entry.js')] }],
    ['Svelte', { html: '<main class="home svelte-abc123"></main>' }],
    ['Astro', { html: '<astro-island component-url="/hero.js"></astro-island>' }],
    ['Gatsby', { html: '<div id="___gatsby"></div>' }],
    ['Remix', { runtime: ['__remixContext'] }],
    ['Lovable', { resources: [resource('https://cdn.gpteng.co/lovable.js')] }],
    ['Replit', { resources: [resource('https://project.replit.app/app.js')] }],
    ['Framer', { resources: [resource('https://framerusercontent.com/image.png', 'image')] }],
    ['Webflow', { html: '<html data-wf-page="page" data-wf-site="site">' }],
    ['WordPress', { resources: [resource('https://site.test/wp-content/theme/app.js')] }],
    ['Wix', { resources: [resource('https://static.wixstatic.com/media/a.png', 'image')] }],
    ['Squarespace', { resources: [resource('https://images.squarespace-cdn.com/a.png', 'image')] }],
    ['Ghost', { html: '<meta name="generator" content="Ghost 6.0">' }],
    ['Contentful', { resources: [resource('https://images.ctfassets.net/a.png', 'image')] }],
    ['Sanity', { resources: [resource('https://cdn.sanity.io/images/a.png', 'image')] }],
    ['Shopify', { resources: [resource('https://cdn.shopify.com/theme.js')] }],
    ['Vercel', { headers: { 'x-vercel-id': 'iad1::abc' } }],
    ['Netlify', { headers: { 'x-nf-request-id': 'abc' } }],
    ['Cloudflare', { headers: { 'cf-ray': 'abc-CMN' } }],
    ['AWS Amplify', { resources: [resource('https://main.d1.amplifyapp.com/app.js')] }],
    ['Firebase Hosting', { resources: [resource('https://site.test/__/firebase/init.js')] }],
    ['Render', { headers: { 'x-render-origin-server': 'Render' } }],
    ['Railway', { headers: { 'x-railway-request-id': 'abc' } }],
    ['GitHub Pages', { resources: [resource('https://owner.github.io/app.js')] }],
    ['Google Tag Manager', { resources: [resource('https://www.googletagmanager.com/gtm.js')] }],
    ['Google Analytics', { resources: [resource('https://www.google-analytics.com/g/collect', 'fetch')] }],
    ['Segment', { resources: [resource('https://cdn.segment.com/analytics.js')] }],
    ['Mixpanel', { resources: [resource('https://api.mixpanel.com/track', 'fetch')] }],
    ['PostHog', { resources: [resource('https://us.i.posthog.com/e', 'fetch')] }],
    ['Plausible', { resources: [resource('https://plausible.io/js/script.js')] }],
    ['Hotjar', { resources: [resource('https://static.hotjar.com/c/hotjar.js')] }],
    ['FullStory', { resources: [resource('https://edge.fullstory.com/s/fs.js')] }],
    ['Sentry', { resources: [resource('https://o1.ingest.sentry.io/api/1/store', 'fetch')] }],
    ['Stripe', { resources: [resource('https://js.stripe.com/v3/')] }],
    ['Paddle', { resources: [resource('https://cdn.paddle.com/paddle.js')] }],
    ['Lemon Squeezy', { resources: [resource('https://app.lemonsqueezy.com/js/lemon.js')] }],
    ['Intercom', { resources: [resource('https://js.intercomcdn.com/widget.js')] }],
    ['Crisp', { resources: [resource('https://client.crisp.chat/l.js')] }],
  ])('detects %s from a strong public signal', (expected, input) => {
    expect(names(input)).toContain(expected)
  })

  it('requires corroboration for builder signals that are individually weak', () => {
    expect(names({ html: '<meta name="generator" content="Bolt.new">' })).not.toContain('Bolt')
    expect(
      names({
        html: '<meta name="generator" content="Bolt.new">',
        resources: [resource('https://stackblitz.com/assets/bolt/runtime.js')],
      })
    ).toContain('Bolt')
    expect(names({ html: '<div data-v0-id="hero"></div>' })).not.toContain('v0')
  })

  it('does not detect editor or framework names from ordinary page copy', () => {
    const detected = names({
      html: `
        <main>
          <p>Move your cursor to continue.</p>
          <p>We loved the angular bolt and windsurf lesson.</p>
          <p>Lovable products can be built with many tools.</p>
        </main>
      `,
    })
    expect(detected).toEqual([])
  })

  it('ignores non-allowlisted headers even when their value contains a fingerprint', () => {
    expect(names({ headers: { authorization: 'Bearer x-vercel-id secret' } })).toEqual([])
  })

  it('returns bounded evidence without raw resource URLs', () => {
    const [next] = detectTechnologies(
      '<script id="__NEXT_DATA__"></script>',
      {},
      [resource('https://site.test/_next/static/app.js?token=secret')],
      ['__NEXT_DATA__']
    )
    expect(next.name).toBe('Next.js')
    expect(next.evidence.length).toBeLessThanOrEqual(4)
    expect(JSON.stringify(next.evidence)).not.toContain('token')
    expect(JSON.stringify(next.evidence)).not.toContain('site.test')
  })
})
