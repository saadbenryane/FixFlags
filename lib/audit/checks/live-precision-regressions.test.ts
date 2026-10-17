import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import { runAllChecks } from './index'
import { runMessagingClarityChecks } from './messaging-clarity'
import { runTrustPsychologyChecks } from './trust-psychology'
import { publicTrustObservations } from './trust'
import { runConversionFrictionChecks } from './conversion-friction'

const url = 'https://studio.example.com/'
const page = (body: string) => parseMetadataFromHtml('<!doctype html><html><body><main><h1>Beautiful digital experiences</h1>' + body + '</main></body></html>', url, 'rendered')
const analytics = '<script>window.gtag=function(){};gtag("config","G-LOCAL")</script>'
const ids = (findings: { checkId: string }[]) => findings.map(finding => finding.checkId)

describe('reviewed live precision regressions', () => {
  it('recognizes labeled cookie controls without vendor-specific CSS and uses the same fact for recovery', async () => {
    const broken = page(analytics)
    const repaired = page(analytics + '<section aria-label="Cookies and analytics"><p>Choose analytics cookies.</p><button>Reject analytics cookies</button><button>Accept analytics cookies</button></section>')
    expect(broken.hasCookieConsent).toBe(false)
    expect(repaired.hasCookieConsent).toBe(true)
    const before = await runAllChecks(url, broken, null, null, [], undefined, undefined, undefined, undefined, true, ['trust'])
    const after = await runAllChecks(url, repaired, null, null, [], undefined, undefined, undefined, undefined, true, ['trust'])
    expect(ids(before.flags)).toContain('cookie-consent-absent')
    expect(ids(after.flags)).not.toContain('cookie-consent-absent')
    expect(after.executions[0].assertions?.find(assertion => assertion.key === 'cookie-consent-signals')?.passed).toBe(true)
  })

  it.each([
    '<button aria-label="Cookie settings"><svg></svg></button>',
    '<a href="/preferences">Manage cookies</a>',
    '<div role="button" tabindex="0">Cookie preferences</div>',
    '<div class="cookie-consent"><p>We use cookies.</p><button>Accept all</button><button>Reject all</button></div>',
  ])('recognizes published consent controls: %s', control => {
    expect(page(analytics + control).hasCookieConsent).toBe(true)
  })

  it.each([
    '<script>const example="cookieconsent cookie banner"</script>',
    '<pre><code>&lt;button&gt;Accept cookies&lt;/button&gt;</code></pre>',
    '<template><button>Accept cookies</button></template>',
    '<div hidden><button>Cookie settings</button></div>',
    '<noscript><button>Cookie settings</button></noscript>',
    '<p>Our documentation describes how a cookie banner works.</p><a href="/cookies">Cookie policy</a>',
  ])('does not certify consent from inactive markup or documentation: %s', content => {
    expect(page(analytics + content).hasCookieConsent).toBe(false)
  })

  it('does not certify a repair or invent a failure when native consent collection is incomplete', async () => {
    const meta = { ...page(analytics), renderedCopy: { version: 1 as const, pageUrl: url, h1s: [], h2s: [], pageText: '', complete: true,
      textTruncated: false, consentControls: [], consentControlsComplete: false } }
    expect(publicTrustObservations(meta)['cookie-consent-signals']).toMatchObject({ complete: false, passed: false })
    const checked = await runAllChecks(url, meta, null, null, [], undefined, undefined, undefined, undefined, true, ['trust'])
    expect(ids(checked.flags)).not.toContain('cookie-consent-absent')
  })

  it('recognizes audiences in the captured introduction without requiring the word for', () => {
    const meta = page('<p>Developers, agents, and code come together on one platform.</p>')
    const observed = { ...meta, renderedCopy: { version: 1 as const, pageUrl: url, h1s: meta.h1s, h2s: [], pageText: meta.pageText,
      headlineSupport: 'Developers, agents, and code come together on one platform.', complete: true, textTruncated: false } }
    expect(ids(runMessagingClarityChecks(observed))).not.toContain('messaging-no-audience')
    const unrelated = { ...observed, renderedCopy: { ...observed.renderedCopy, headlineSupport: '', pageText: 'Developers in the footer' } }
    expect(ids(runMessagingClarityChecks(unrelated))).toContain('messaging-no-audience')
  })

  it('keeps case-study navigation as a proof reference without inventing testimonial content', () => {
    const meta = page('<p>I design products and work with customers through discovery, implementation, and launch.</p><a href="/work">View case studies</a><a href="/contact">Start a project</a>')
    expect(ids(runTrustPsychologyChecks(meta))).not.toContain('trust-testimonial-quality')
    expect(ids(runTrustPsychologyChecks(meta))).not.toContain('trust-no-authority-signals')
  })

  it('reviews a real anonymous quote and accepts separately recorded attributed proof', () => {
    const broken = page('<figure><blockquote>Great product.</blockquote><figcaption>Customer feedback</figcaption></figure><a href="/start">Get started</a>')
    const repaired = page('<figure><blockquote>Great product.</blockquote><figcaption>Alex Smith, CTO at Acme</figcaption></figure><a href="/start">Get started</a>')
    expect(ids(runTrustPsychologyChecks(broken))).toContain('trust-testimonial-quality')
    expect(ids(runTrustPsychologyChecks(repaired))).not.toContain('trust-testimonial-quality')
    expect(ids(runTrustPsychologyChecks(page('<p>Read our guide to the \"best way to configure a long descriptive title for your development environment\".</p><a href="/work">View case studies</a><a href="/start">Get started</a>')))).not.toContain('trust-testimonial-quality')
  })

  it('does not let an unrelated quote or team biography certify an anonymous testimonial', () => {
    const meta = page('<p>Alex Smith, CTO at Acme, leads our team.</p><blockquote>Great product.</blockquote><a href="/start">Get started</a>')
    expect(ids(runTrustPsychologyChecks(meta))).toContain('trust-testimonial-quality')
  })

  it('does not adopt a page footer biography as quote attribution', () => {
    const meta = page('<blockquote>Great product.</blockquote><section><p>Other content.</p></section><footer>Alex Smith, CTO at Acme, leads our team.</footer><a href="/start">Get started</a>')
    expect(meta.testimonialBlocks).toEqual([{ quote: 'Great product.', attribution: null }])
    expect(ids(runTrustPsychologyChecks(meta))).toContain('trust-testimonial-quality')
  })

  it('reports measured form fields without claiming measured conversion loss', () => {
    const meta = { ...page(''), maxConversionFormInputs: 7, totalFormInputs: 7 }
    const finding = runConversionFrictionChecks(meta).find(finding => finding.checkId === 'friction-form-too-many-fields')
    expect(finding).toBeDefined()
    expect(finding?.evidence).toContain('7')
    expect(finding?.evidence).toContain('not measured')
    expect(finding?.evidence).not.toMatch(/each additional field reduces|causing.*abandon/i)
  })
})
