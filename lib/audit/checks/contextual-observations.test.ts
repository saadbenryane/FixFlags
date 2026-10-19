import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import { runSlopChecks } from './slop'
import { runLayoutChecks } from './layout'
import type { CaptureMetrics } from '../capture-metrics'
import { isCustomerFlag } from '../attention'
import { repairGuidanceState, repairGuidanceText } from '@/lib/improvements/repair-guidance'

describe('context-dependent observations from the actual public precision review', () => {
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
