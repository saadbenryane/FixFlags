import { describe, expect, it } from 'vitest'
import {
  attentionItemToExplorerFlag,
  buildAttentionExplorerModel,
} from '@/lib/products/attention-explorer'
import type { ProductAttentionItemDTO } from '@/lib/products/workspace'

function attentionItem(
  overrides: Partial<ProductAttentionItemDTO> = {}
): ProductAttentionItemDTO {
  return {
    id: 'improvement-1',
    title: 'Slow load on 3G',
    judgment: 'Mobile visitors bounce.',
    recommendedChange: 'Reduce bundle size.',
    successCondition: 'Content appears within 5 seconds.',
    priority: 90,
    status: 'PROPOSED',
    evidence: 'Meaningful text after 11286ms.',
    rubric: 'EXPERIENCE',
    severity: 'CRITICAL',
    checkId: 'slow-3g',
    pageUrl: 'https://example.com/',
    pageUrls: ['https://example.com/'],
    impactTag: 'conversion',
    source: 'DETERMINISTIC',
    evidenceTargets: null,
    sourceReviewId: 'review-a',
    sourceFlagId: 'flag-a',
    prompt: 'Fix slow 3G load',
    ...overrides,
  }
}

describe('attention-explorer', () => {
  it('maps flag identity, page paths, and impact from attention items', () => {
    const flag = attentionItemToExplorerFlag(attentionItem())
    expect(flag).toMatchObject({
      id: 'flag-a',
      checkId: 'slow-3g',
      pageUrl: 'https://example.com/',
      pageUrls: ['https://example.com/'],
      impactTag: 'conversion',
      hasFixPrompt: true,
      truthLabel: 'Detected',
    })
  })

  it('builds per-flag captures when priorities span multiple source reviews', () => {
    const items = [
      attentionItem({
        id: 'i1',
        sourceReviewId: 'review-a',
        sourceFlagId: 'flag-a',
      }),
      attentionItem({
        id: 'i2',
        title: 'Missing OG image',
        sourceReviewId: 'review-b',
        sourceFlagId: 'flag-b',
        checkId: 'og-image-missing',
      }),
    ]
    const model = buildAttentionExplorerModel(items, {
      'review-a': {
        displayHost: 'example.com',
        desktopScreenshot: '/shots/a-desktop.webp',
        mobileScreenshot: '/shots/a-mobile.webp',
        visuals: {},
      },
      'review-b': {
        displayHost: 'other.example',
        desktopScreenshot: '/shots/b-desktop.webp',
        mobileScreenshot: null,
        visuals: {},
      },
    })

    expect(model.capturesByFlagId).toEqual({
      'flag-a': {
        desktopScreenshot: '/shots/a-desktop.webp',
        mobileScreenshot: '/shots/a-mobile.webp',
      },
      'flag-b': {
        desktopScreenshot: '/shots/b-desktop.webp',
        mobileScreenshot: null,
      },
    })
    expect(model.displayHostByFlagId).toEqual({
      'flag-a': 'example.com',
      'flag-b': 'other.example',
    })
    expect(model.desktopScreenshot).toBe('/shots/a-desktop.webp')
  })

  it('does not fabricate captures when source review evidence is missing', () => {
    const model = buildAttentionExplorerModel([attentionItem()], {})
    expect(model.desktopScreenshot).toBeNull()
    expect(model.mobileScreenshot).toBeNull()
    expect(model.capturesByFlagId).toEqual({})
  })
})
