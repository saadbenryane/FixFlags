import { describe, expect, it } from 'vitest'
import { browserCollectionRequirements } from '../browser-requirements'

const consumer = (module: string) => ({ workKind: 'check', workInput: {
  pageUrl: 'https://example.com/', position: 0, primary: true, role: 'primary', module,
} })
describe('recorded browser evidence consumers', () => {
  it.each(['metadata', 'measurement', 'seo', 'trust'])('keeps %s on desktop without unrelated axe or mobile collection', module => {
    expect(browserCollectionRequirements([consumer(module), { workKind: 'finalize', workInput: null }]))
      .toEqual({ collectMobile: false, collectAccessibility: false })
  })
  it('collects axe for accessibility and both devices for console and native mobile metrics', () => {
    expect(browserCollectionRequirements([consumer('accessibility')])).toEqual({ collectMobile: true, collectAccessibility: true })
    expect(browserCollectionRequirements([consumer('accessibility')], { 'buttons-no-text': 1 }))
      .toEqual({ collectMobile: false, collectAccessibility: true })
    expect(browserCollectionRequirements([consumer('accessibility')], { 'axe-target-size': 1 }))
      .toEqual({ collectMobile: true, collectAccessibility: true })
    for (const moduleId of ['mobile-ux-quality', 'interaction', 'layout'])
      expect(browserCollectionRequirements([consumer(moduleId)])).toEqual({ collectMobile: true, collectAccessibility: false })
    expect(browserCollectionRequirements([consumer('console')])).toEqual({ collectMobile: true, collectAccessibility: true })
    expect(browserCollectionRequirements([consumer('accessibility'), consumer('console')]))
      .toEqual({ collectMobile: true, collectAccessibility: true })
  })
  it('retains the original mobile motion window even when no check directly requests metrics', () => {
    expect(browserCollectionRequirements([{ workKind: 'motion', workInput: null }]))
      .toEqual({ collectMobile: true, collectAccessibility: false })
  })
  it.each([[], [{ workKind: 'unknown', workInput: null }], [consumer('unknown')], [{ workKind: 'check', workInput: {} }]].map(consumers => ({ consumers })))(
    'preserves complete collection for unknown or historical responsibilities: $consumers', ({ consumers }) => {
      expect(browserCollectionRequirements(consumers)).toEqual({ collectMobile: true, collectAccessibility: true })
    })
})
