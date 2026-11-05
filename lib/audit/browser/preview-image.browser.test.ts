import { afterAll, describe, expect, it } from 'vitest'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { runOgImageUrlCheck } from '../checks/metadata-checks'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQImWP4r8TwX4kBhP8rMQAAI6YEhXbc9zcAAAAASUVORK5CYII=', 'base64')

run('native preview-image decoding', () => {
  afterAll(closeBrowser)
  it('flags corrupt PNG data despite successful HTTP and an image content type', async () => {
    const corrupt = png.subarray(0, 33)
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      for (const [bytes, contentType, visible, failures] of [[corrupt, 'image/png', false, 1], [png, 'image/png', true, 0], [png, 'image/svg+xml', false, 0]] as const) {
        const loaded = await page.evaluate(async base64 => new Promise<boolean>(resolve => {
          const image = new Image()
          image.onload = () => resolve(image.naturalWidth > 0)
          image.onerror = () => resolve(false)
          image.src = 'data:' + base64.type + ';base64,' + base64.bytes
        }), { bytes: bytes.toString('base64'), type: contentType })
        expect(loaded).toBe(visible)
        const scope: { complete?: boolean } = {}
        const flags = await runOgImageUrlCheck('https://example.com/', { ogImage: 'https://example.com/preview.png' }, { scope,
          fetchDocument: async () => ({ statusCode: 200, headers: { 'content-type': contentType }, body: bytes, complete: true }),
        })
        expect(flags.map(flag => flag.checkId)).toEqual(failures ? ['og-image-broken'] : [])
        expect(scope.complete).toBe(contentType !== 'image/svg+xml')
      }
    } finally { await context.close() }
  })
})
