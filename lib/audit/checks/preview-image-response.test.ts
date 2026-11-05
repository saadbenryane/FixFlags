import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { previewImageResponse, previewImageDecodingSchema } from './preview-image-response'
import { runOgImageUrlCheck } from './metadata-checks'
import { destinationContext, DESTINATION_VERIFICATION_RULE } from './destination-evidence'
import { scopedAssertionForTarget } from './verification'
import { readCheckReceipt } from './receipt'
import type { CheckAssertion } from './assertion'

const pageUrl = 'https://example.com/', imageUrl = pageUrl + 'preview.png'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQImWP4r8TwX4kBhP8rMQAAI6YEhXbc9zcAAAAASUVORK5CYII=', 'base64')
const document = (body: string | Buffer = png, complete = true) => ({ statusCode: 200,
  headers: { 'content-type': 'image/png' }, body, complete })
const receipt = (assertions: CheckAssertion[]) => ({ kind: 'site-module-check' as const, version: 1 as const, module: 'og-image',
  pageUrl, applicable: true, passed: true, complete: true, assertions,
  execution: { auditId: 'after', taskId: 'image-check', checkVersion: 1, source: 'http' as const, collectedAt: new Date().toISOString() } })

describe('bounded preview image decoding', () => {
  it('rejects fabricated decoding success without its raster dimensions and policy', () => {
    for (const value of [
      { version: 1, state: 'decoded', reason: 'decoded', format: 'png' },
      { version: 1, state: 'decoded', reason: 'execution_budget', format: 'png', width: 2, height: 2 },
      { version: 1, state: 'decoded', reason: 'decoded', format: 'png', width: 5000, height: 4000 },
    ]) expect(previewImageDecodingSchema.safeParse(value).success).toBe(false)
  })

  it.each(['png', 'jpeg', 'webp', 'gif'] as const)('decodes actual %s pixels and retains no body', async format => {
    const bytes = await sharp(png).toFormat(format).toBuffer()
    const observed = await previewImageResponse(document(bytes))
    expect(observed.decoding).toMatchObject({ version: 1, state: 'decoded', format, width: 2, height: 2 })
    expect(JSON.stringify(observed)).not.toContain(bytes.toString('base64'))
    expect(observed).not.toHaveProperty('body')
  })

  it('cannot treat a readable PNG header as decodable pixels', async () => {
    const observed = await previewImageResponse(document(png.subarray(0, 33)))
    expect(observed).toMatchObject({ statusCode: 200, hasContent: true, decoding: { state: 'invalid', reason: 'invalid_data', format: 'png' } })
  })

  it('does not decode incomplete bytes, unsupported document loaders or historical text', async () => {
    for (const [body, complete, reason] of [
      [png, false, 'incomplete_body'],
      [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="file:///private"/></svg>'), true, 'unsupported_format'],
      ['Historical decoded text is not the original bytes', true, 'byte_evidence_unavailable'],
    ] as const) expect((await previewImageResponse(document(body, complete))).decoding).toMatchObject({ state: 'unknown', reason })
    expect((await previewImageResponse(document(), Date.now() + 500)).decoding)
      .toMatchObject({ state: 'unknown', reason: 'execution_budget' })
  })

  it('keeps pixel limits distinct from a broken image', async () => {
    const bytes = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: '#f00' } }).png().toBuffer()
    expect((await previewImageResponse(document(bytes))).decoding).toMatchObject({ state: 'unknown', reason: 'resource_limit' })
  })

  it('requires independent decoding proof for a corrupt image repair', async () => {
    const before: CheckAssertion[] = []
    const [flag] = await runOgImageUrlCheck(pageUrl, { ogImage: imageUrl }, {
      fetchDocument: async () => document(png.subarray(0, 33)), record: value => before.push(value),
    })
    expect(flag).toMatchObject({ checkId: 'og-image-broken', verificationRule: DESTINATION_VERIFICATION_RULE })
    const repaired: CheckAssertion[] = []
    expect(await runOgImageUrlCheck(pageUrl, { ogImage: imageUrl }, {
      fetchDocument: async () => document(), record: value => repaired.push(value),
    })).toEqual([])
    expect(scopedAssertionForTarget({ receipt: receipt(repaired), checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ receipt: receipt(before), checkId: flag.checkId, flag })?.assertion.passed).toBe(false)
    const old = receipt([{ key: 'preview-image-response', name: 'Response', expected: 'Successful image response',
      observed: 'HTTP 200 image/png with content', passed: true, complete: true, context: destinationContext(pageUrl, imageUrl) }])
    expect(scopedAssertionForTarget({ receipt: old, checkId: flag.checkId, flag })).toBeUndefined()
    const serialized = JSON.stringify(old)
    expect(readCheckReceipt(old)).toMatchObject({ passed: false, complete: false, assertions: [{ passed: true, complete: true }] })
    expect(JSON.stringify(old)).toBe(serialized)
    const oldResponseFlag = { ...flag, evidenceTargets: [{ ...flag.evidenceTargets![0], context: destinationContext(pageUrl, imageUrl) }] }
    expect(scopedAssertionForTarget({ receipt: old, checkId: flag.checkId, flag: oldResponseFlag })?.assertion.passed).toBe(true)
    expect(readCheckReceipt({ passed: true, assertions: old.assertions })).toMatchObject({ legacy: true, assertions: [{ passed: true, complete: false }] })
  })
})
