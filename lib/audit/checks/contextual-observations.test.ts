import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import { runSlopChecks } from './slop'
import { runLayoutChecks } from './layout'
import { runTrustPsychologyChecks } from './trust-psychology'
import type { CaptureMetrics } from '../capture-metrics'
import { isCustomerFlag } from '../attention'
import { repairGuidanceState, repairGuidanceText } from '@/lib/improvements/repair-guidance'

describe('context-dependent observations from the actual public precision review', () => {
  it('retains a superlative match and its context without diagnosing an article question as an unsupported claim', () => {
    const text = 'Is the JPEG format still the best for image compression? Unfortunately, there is no clear answer. Every task has its own context. Compare the best quality and codec parameters by compressing an image with two codecs 100 times.'
    const meta = parseMetadataFromHtml(`<html><head><title>Image formats and compression</title></head><body><h1>Image formats and compression</h1><p>${text}</p></body></html>`, 'https://developer.mozilla.org/en-US/blog/image-formats-codecs-compression-tools/')
    const before = structuredClone(meta)
    const flag = runTrustPsychologyChecks(meta, { purpose: 'article', reasons: [] }).find(flag => flag.checkId === 'trust-unsupported-claims')!
    expect(flag).toBeDefined()
    expect(flag).toMatchObject({ confidence: 0.85, severity: 'IMPORTANT', source: 'DETERMINISTIC' })
    expect(flag.problem).toMatch(/^Review /)
    expect(flag.problem).not.toContain('without supporting evidence')
    expect(flag.evidence).toContain('the best')
    expect(flag.evidence).toContain('there is no clear answer')
    expect(flag.evidence).not.toContain('no specific data points')
    expect(flag.evidence).not.toContain('Claims without evidence reduce trust')
    expect(flag.fix).toMatch(/^Review /)
    expect(flag.fix).toContain('If ')
    expect(flag.fix).toContain('questions')
    expect(isCustomerFlag(flag)).toBe(false)
    expect(repairGuidanceState(flag)).toBe('ready')
    expect(meta).toEqual(before)
  })

  it('preserves the existing superlative detection conditions and specificity signals', () => {
    const meta = (heading: string, text: string) => parseMetadataFromHtml(`<html><head><title>Product</title></head><body><h1>${heading}</h1><p>${text}</p></body></html>`, 'https://example.test/')
    const find = (heading: string, text: string) => runTrustPsychologyChecks(meta(heading, text)).find(flag => flag.checkId === 'trust-unsupported-claims')
    expect(find('The fastest product', 'A product for teams.')).toMatchObject({ severity: 'IMPORTANT', confidence: 0.85 })
    expect(find('Product', 'Choose the best option.')).toBeUndefined()
    expect(find('Product', 'Choose the best option and compare the best available format.')).toBeDefined()
    expect(find('The fastest product', 'A measured benchmark is available.')).toBeUndefined()
    expect(find('Product', 'A product for teams.')).toBeUndefined()
  })

  it('retains the observed placeholder phrase without diagnosing educational copy as unfinished', () => {
    const text = 'Scan any URL for Lorem ipsum, TODO markers, AI-builder template artifacts.'
    const meta = parseMetadataFromHtml(`<html><head><title>Placeholder Copy Detector</title></head><body><h1>Placeholder Copy Detector</h1><p>${text}</p></body></html>`, 'https://fixflags.com/tools/placeholder-detector')
    const flag = runSlopChecks(meta).find(flag => flag.checkId === 'placeholder-copy-detected')!
    expect(flag).toBeDefined()
    expect(flag.evidence).toContain('Scan any URL for Lorem ipsum, TODO markers')
    expect(flag.problem).not.toMatch(/unfinished|placeholder.*detected/i)
    expect(isCustomerFlag(flag)).toBe(false)
    expect(flag.fix).toMatch(/^Review /)
    expect(flag.fix).toContain('If ')
    expect(repairGuidanceText(flag)).toBe(flag.fix)
    expect(repairGuidanceState(flag)).toBe('ready')
  })

  it.each([948, 4470])('keeps the measured %ipx action depth without establishing its task priority or a blocked journey', depth => {
    const metrics = { mobileViewportHeight: 812, mobileDocumentHeight: 7000, mobilePrimaryCtaTopPx: depth,
      mobilePrimaryCtaText: 'List Your Practice' } as CaptureMetrics
    const before = structuredClone(metrics)
    const [flag] = runLayoutChecks(metrics)
    expect(flag).toBeDefined()
    expect(flag!.evidence).toContain(`starts at ${depth}px`)
    expect(flag!.problem).not.toMatch(/primary|hidden|blocked/i)
    expect(isCustomerFlag(flag!)).toBe(false)
    expect(flag!.fix).toMatch(/^Review /)
    expect(flag!.fix).toContain('If ')
    expect(metrics).toEqual(before)
    expect(runLayoutChecks({ ...metrics, mobilePrimaryCtaTopPx: 811 })).toEqual([])
    expect(runLayoutChecks({ ...metrics, mobilePrimaryCtaTopPx: null })).toEqual([])
  })
})
