import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { parseMetadataFromHtml } from '../metadata'
import { runConversionFrictionChecks } from '../checks/conversion-friction'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native form ownership in captured metadata', () => {
  afterAll(closeBrowser)
  it.each([
    { name: 'external fields', html: '<form id="signup"><button>Sign up</button></form>' +
      Array.from({ length: 7 }, (_, i) => '<input form="signup" required name="field' + i + '">').join(''), total: 7, conversion: 7, missing: 0 },
    { name: 'fields diverted to a missing form', html: '<form id="signup"><button>Sign up</button><input required>' +
      Array.from({ length: 6 }, () => '<input form="missing">').join('') + '</form>', total: 1, conversion: 1, missing: 0 },
    { name: 'external submit label', html: '<form id="signup">' + '<input required>'.repeat(6) + '</form><input type="submit" value="Sign up" form="signup">', total: 6, conversion: 6, missing: 0 },
    { name: 'first matching ID belongs to another element', html: '<div id="signup"></div><form id="signup"><button>Sign up</button><input form="signup"></form>', total: 0, conversion: 0, missing: 0 },
    { name: 'empty form attribute', html: '<form id="signup"><button>Sign up</button><input form=""></form>', total: 0, conversion: 0, missing: 0 },
  ])('matches native owners for $name', async fixture => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><h1>Plan work with your team</h1>' + fixture.html + '</main>')
      const native = await page.evaluate(() => Array.from(document.querySelectorAll('input:not([type="submit"])'))
        .filter(element => (element as HTMLInputElement).form !== null).length)
      expect(native).toBe(fixture.total)
      const metadata = parseMetadataFromHtml(await page.content(), 'https://example.com/', 'rendered')
      expect(metadata).toMatchObject({ totalFormInputs: native, maxConversionFormInputs: fixture.conversion, formInputsMissingValidation: fixture.missing })
      expect(runConversionFrictionChecks(metadata).some(flag => flag.checkId === 'friction-form-too-many-fields')).toBe(fixture.conversion > 5)
    } finally { await context.close() }
  })
})
