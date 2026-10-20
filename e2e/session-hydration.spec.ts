import { expect, test } from '@playwright/test'

for (const theme of ['light', 'dark'] as const) {
  for (const lookup of ['success', 'unavailable'] as const) {
    test(`streamed documentation survives a ${lookup} session lookup in ${theme}`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width: 320, height: 900 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' })
      await context.addCookies([{ name: 'fixflags_analytics_consent', value: 'denied', url: baseURL! }])
      await page.addInitScript(value => {
        localStorage.setItem('theme', value)
        const observation = { published: false, stopped: false, losses: [] as number[] }
        Object.assign(window, { documentationHydration: observation })
        function frame() {
          const visible = [...document.querySelectorAll('h1')].some(element =>
            element.textContent === 'Google Analytics' && element.checkVisibility(),
          )
          if (visible) observation.published = true
          else if (observation.published) observation.losses.push(performance.now())
          if (!observation.stopped) requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
      }, theme)

      let releaseModule!: () => void
      const pendingModule = new Promise<void>(resolve => { releaseModule = resolve })
      let moduleHeld = false
      await page.route('**/_next/static/chunks/**', async route => {
        if (decodeURIComponent(new URL(route.request().url()).pathname).includes('/app/(docs)/docs/layout-')) {
          moduleHeld = true
          await pendingModule
        }
        await route.continue()
      })
      let lookupSettled = false
      if (lookup === 'unavailable') {
        await page.route('**/api/me', async route => {
          await route.abort('failed')
          lookupSettled = true
        })
      } else {
        page.on('response', response => {
          if (new URL(response.url()).pathname === '/api/me' && response.status() === 200) lookupSettled = true
        })
      }
      const article = page.getByRole('heading', { level: 1, name: 'Google Analytics', exact: true })
      try {
        await page.goto('/docs/integrations/google-analytics', { waitUntil: 'commit' })
        await expect(article).toBeVisible()
        await expect.poll(() => moduleHeld).toBe(true)
        await expect.poll(() => lookupSettled).toBe(true)
        // Hold only the documentation module across the background response.
        // Observe natural paint opportunities without allowing hydration to finish.
        await page.evaluate(() => new Promise<void>(resolve => {
          let frames = 0
          function frame() {
            if (++frames === 12) resolve()
            else requestAnimationFrame(frame)
          }
          requestAnimationFrame(frame)
        }))
        await expect(article).toBeVisible()
      } finally {
        releaseModule()
      }
      await expect(page.getByRole('button', { name: 'Open documentation navigation', exact: true })).toBeEnabled()
      const observation = await page.evaluate(() => {
        const state = (window as unknown as { documentationHydration: { published: boolean; stopped: boolean; losses: number[] } }).documentationHydration
        state.stopped = true
        return state
      })
      await test.info().attach('documentation-hydration', { body: JSON.stringify({ theme, lookup, moduleHeld, lookupSettled, ...observation }), contentType: 'application/json' })
      expect(observation.published).toBe(true)
      expect(observation.losses).toEqual([])
    })
  }
}

for (const theme of ['light', 'dark'] as const) {
  for (const motion of ['reduce', 'no-preference'] as const) {
    test(`floating chat respects native keyboard focus in ${theme} with ${motion} motion`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width: 768, height: 900 })
      await page.emulateMedia({ colorScheme: theme, reducedMotion: motion })
      await context.addCookies([{ name: 'fixflags_analytics_consent', value: 'denied', url: baseURL! }])
      await page.addInitScript(value => localStorage.setItem('theme', value), theme)
      const session = page.waitForResponse(response => new URL(response.url()).pathname === '/api/me' && response.status() === 200)
      await page.goto('/docs/getting-started', { waitUntil: 'domcontentloaded' })
      await session
      await expect(page.getByRole('heading', { level: 1, name: 'Getting started', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Open documentation navigation', exact: true })).toBeEnabled()
      await expect(page.getByRole('button', { name: 'Open live chat', exact: true })).toBeEnabled()
      await page.evaluate(() => document.fonts.ready)
      await page.locator('#main-content').focus()
      const samples = []
      for (let step = 0; step < 32; step++) {
        await page.keyboard.press('Tab')
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const sample = await page.evaluate(() => {
          const element = document.activeElement
          if (!(element instanceof HTMLElement) || ['BODY', 'HTML'].includes(element.tagName)) return null
          let exposed = false
          for (const box of element.getClientRects()) {
            const left = Math.max(0, box.left), right = Math.min(innerWidth, box.right)
            const top = Math.max(0, box.top), bottom = Math.min(innerHeight, box.bottom)
            if (right <= left || bottom <= top) continue
            for (const x of [.15, .5, .85]) for (const y of [.15, .5, .85]) {
              const hit = document.elementFromPoint(left + (right - left) * x, top + (bottom - top) * y)
              if (hit === element || (hit && element.contains(hit))) exposed = true
            }
          }
          return { name: element.getAttribute('aria-label') || element.textContent?.trim(), exposed, focusVisible: element.matches(':focus-visible') }
        })
        if (sample) {
          samples.push(sample)
          expect(sample.exposed, `Focused ${sample.name} must remain exposed`).toBe(true)
          expect(sample.focusVisible).toBe(true)
        }
      }
      expect(samples.some(sample => sample.name === 'Terms')).toBe(true)
      expect(samples.some(sample => sample.name === 'Open live chat')).toBe(true)
      await test.info().attach('native-focus', { body: JSON.stringify({ theme, motion, samples }), contentType: 'application/json' })
    })
  }
}
