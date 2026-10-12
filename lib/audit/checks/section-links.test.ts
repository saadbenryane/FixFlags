import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import { sectionLinkObservations, SECTION_LINK_VERIFICATION_RULE } from './section-links'
import { scopedAssertionForTarget } from './verification'
import { runSeoChecks } from './seo'
import { runSlopChecks } from './slop'
import { checkReceiptSchema } from './receipt'
import type { CaptureObservationScope } from '../browser/observation-scope'

const pageUrl = 'https://example.com/service?token=PRIVATE_QUERY'
const scope: CaptureObservationScope = { pageUrl, finalUrl: pageUrl, profile: 'desktop-fixture', access: 'public' }
function observe(body: string, overrides: Partial<CaptureObservationScope> = {}) {
  const metadata = parseMetadataFromHtml('<!doctype html><html><head><title>Service</title></head><body>' + body + '</body></html>', overrides.finalUrl ?? pageUrl)
  return sectionLinkObservations(overrides.finalUrl ?? pageUrl, metadata, { ...scope, ...overrides })
}
function receipt(observed: ReturnType<typeof observe>) {
  return { kind: 'site-module-check' as const, version: 1 as const, module: 'seo', pageUrl, applicable: true, passed: !observed.flags.length,
    complete: observed.complete, assertions: observed.assertions,
    execution: { auditId: 'repair', taskId: 'section-check', checkVersion: 1, source: 'rendered-dom' as const, collectedAt: '2026-10-12T12:00:00.000Z' } }
}

describe('declared section-link evidence', () => {
  it('matches exact IDs, percent-encoded targets and named anchors', () => {
    const checked = observe('<a href="#Contact">Contact</a><section id="Contact"></section>' +
      '<a href="#caf%C3%A9%20menu">Menu</a><section id="café menu"></section>' +
      '<a href="#Legacy">Legacy</a><a name="Legacy"></a><a href="#TOP">Top</a>')
    expect(checked.flags).toEqual([])
    expect(checked.complete).toBe(true)
    expect(checked.assertions).toHaveLength(4)
    expect(checked.assertions.every(assertion => assertion.passed)).toBe(true)
  })

  it('does not hide case mismatches or whitespace in IDs', () => {
    const checked = observe('<a href="#contact">Contact</a><section id="Contact"></section><a href="#price">Price</a><section id=" price "></section>')
    expect(checked.flags[0]).toMatchObject({ checkId: 'broken-page-anchors', problem: '2 on-page links point to missing sections',
      verificationRule: SECTION_LINK_VERIFICATION_RULE })
    expect(checked.assertions.every(assertion => !assertion.passed && assertion.complete)).toBe(true)
  })

  it('resolves all same-document links against the observed base and preserves query identity', () => {
    const checked = observe('<base href="/service?token=PRIVATE_QUERY"><a href="?token=PRIVATE_QUERY#missing">Local</a>' +
      '<a href="?token=OTHER_QUERY#missing">Other document</a><a href="/other#missing">Other page</a>')
    expect(checked.assertions).toHaveLength(1)
    expect(JSON.stringify(checked.flags)).not.toContain('PRIVATE_QUERY')
    const basedElsewhere = observe('<base href="/other"><a href="#missing">Other section</a>')
    expect(basedElsewhere.flags).toEqual([])
    expect(basedElsewhere.assertions).toEqual([])
  })

  it('retains the number of broken links with one proof scope per missing target', () => {
    const checked = observe('<a href="#missing">Header link</a><a href="#missing">Footer link</a>')
    expect(checked.flags[0].problem).toBe('2 on-page links point to missing sections')
    expect(checked.assertions).toHaveLength(1)
    expect(checked.flags[0].evidenceTargets).toHaveLength(1)
  })

  it('keeps routing and text-fragment navigation unknown instead of inventing missing sections', () => {
    const checked = observe('<a href="#/signup">Signup</a><a href="#!account">Account</a><a href="#:~:text=hello">Text</a>')
    expect(checked.flags).toEqual([])
    expect(checked.complete).toBe(false)
    expect(checked.assertions.every(assertion => !assertion.complete)).toBe(true)
  })

  it('does not retrofit exact recovery onto normalized historical identifiers', () => {
    const metadata = parseMetadataFromHtml('<a href="#contact">Contact</a>', pageUrl)
    delete metadata.anchorNames
    const checked = sectionLinkObservations(pageUrl, metadata, scope)
    expect(checked.complete).toBe(false)
    expect(checked.flags[0].verificationRule).toBeUndefined()
    expect(checked.assertions[0].complete).toBe(false)
    expect(observe('<a href="#contact">Contact</a>', { access: 'credentialed:unknown' }).complete).toBe(false)
  })

  it('bounds large documents without discarding observed failures or certifying uninspected targets', () => {
    const checked = observe(Array.from({ length: 301 }, (_, index) => `<a href="#section-${index}">Section ${index}</a>`).join(''))
    expect(checked.assertions).toHaveLength(300)
    expect(checked.flags[0].evidenceTargets).toHaveLength(300)
    expect(checked.complete).toBe(false)
    expect(checkReceiptSchema.safeParse(receipt(checked)).success).toBe(true)
  })

  it('requires positive evidence for every original target under the same capture conditions', () => {
    const before = observe('<a href="#contact">Contact</a><a href="#pricing">Pricing</a>')
    const repaired = observe('<a href="#contact">Contact</a><section id="contact"></section><a href="#pricing">Pricing</a><section id="pricing"></section>')
    const comparable = scopedAssertionForTarget({ receipt: receipt(repaired), checkId: 'broken-page-anchors', flag: before.flags[0] })
    expect(comparable?.assertion).toMatchObject({ passed: true, complete: true })
    for (const other of [
      observe('<section id="contact"></section><section id="pricing"></section>'),
      observe('<a href="#other">Other</a><section id="other"></section>'),
      observe('<a href="#contact">Contact</a><section id="contact"></section>'),
      observe('<a href="#contact">Contact</a><a href="#pricing">Pricing</a>', { profile: 'mobile-fixture' }),
      observe('<a href="#contact">Contact</a><a href="#pricing">Pricing</a>', { finalUrl: 'https://example.com/other' }),
      observe('<a href="#contact">Contact</a><a href="#pricing">Pricing</a>', { access: 'credentialed:another-session' }),
    ]) expect(scopedAssertionForTarget({ receipt: receipt(other), checkId: 'broken-page-anchors', flag: before.flags[0] })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(before), checkId: 'broken-page-anchors', flag: before.flags[0] })?.assertion.passed).toBe(false)
  })

  it('migrates both SEO detection and CTA placeholder checks to exact native targets', async () => {
    const metadata = parseMetadataFromHtml('<a href="#Contact">Contact sales</a><a name="Contact"></a>', pageUrl)
    expect((await runSeoChecks(pageUrl, metadata)).some(flag => flag.checkId === 'broken-page-anchors')).toBe(false)
    expect(runSlopChecks(metadata).some(flag => flag.checkId === 'cta-dead-link')).toBe(false)
  })
})
