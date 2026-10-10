import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import { detectPagePurpose } from '../page-purpose'
import { runLayoutChecks } from '../checks/layout'
import { runConversionFrictionChecks } from '../checks/conversion-friction'

const notice = `This domain is for use in documentation examples without needing permission. This is not a service; avoid relying on it for testing and monitoring purposes. ${'Translated documentation notice. '.repeat(70)}`
const html = (action: string) => `<html><head><title>Domain notice</title></head><body><p>${notice}</p>${action}</body></html>`

describe('documentation-only notice purpose', () => {
  it('recognizes a long translated notice on an arbitrary host without hiding real metadata omissions', () => {
    const meta = parseMetadataFromHtml(html('<a href="https://reference.test/information">Learn more</a>'))
    const purpose = detectPagePurpose(meta, 'https://unseen.test/')
    expect(purpose.purpose).toBe('placeholder')
    expect(runConversionFrictionChecks(meta, purpose).map(flag => flag.checkId)).not.toContain('friction-no-commitment-path')
    expect(runLayoutChecks({ mobilePrimaryCtaTopPx: 900 } as never, purpose.purpose)).toEqual([])
    expect(meta.h1s).toEqual([])
    expect(meta.description).toBeNull()
  })

  it('keeps conversion checks when that page also offers a commercial action', () => {
    const meta = parseMetadataFromHtml(html('<a href="/checkout">Buy now</a>'))
    expect(detectPagePurpose(meta, 'https://unseen.test/').purpose).toBe('marketing')
  })
})
