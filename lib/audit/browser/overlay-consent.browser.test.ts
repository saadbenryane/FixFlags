import { afterAll, describe, expect, it } from 'vitest'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { detectOverlayAtPoint, isDismissibleConsentChrome } from './overlay-probe'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
const page = (buttons: string) => '<!doctype html><html><head><title>Consent</title></head><body style="margin:0">' +
  '<a id="cta" href="/start" style="position:absolute;top:500px;left:100px;width:200px;height:48px;background:#000;color:#fff">Get started</a>' +
  '<div role="dialog" style="position:fixed;left:0;right:0;top:480px;height:120px;z-index:40;background:#fff">' +
  `<p>Optional analytics</p>${buttons}</div></body></html>`

run('consent banners over the main button', () => {
  afterAll(closeBrowser)

  it.each(['<button>Allow analytics</button><button>Only necessary</button>',
    '<button>Accept all</button><button>Necessary cookies only</button>',
    '<button>Allow</button><button>Use only essential</button>'])('treats a banner with a necessary-only choice as consent: %s', async buttons => {
    const context = await (await getAuditBrowser()).newContext({ viewport: { width: 800, height: 700 } })
    try {
      const tab = await context.newPage()
      await tab.setContent(page(buttons))
      const blocker = await detectOverlayAtPoint(tab, '#cta', { persistMs: 0 })
      expect(blocker && isDismissibleConsentChrome(blocker)).toBe(true)
    } finally { await context.close() }
  })

  it('still reports a banner with only an accept choice', async () => {
    const context = await (await getAuditBrowser()).newContext({ viewport: { width: 800, height: 700 } })
    try {
      const tab = await context.newPage()
      await tab.setContent(page('<button>Allow analytics</button>'))
      const blocker = await detectOverlayAtPoint(tab, '#cta', { persistMs: 0 })
      expect(blocker).not.toBeNull()
      expect(isDismissibleConsentChrome(blocker!)).toBe(false)
    } finally { await context.close() }
  })
})
