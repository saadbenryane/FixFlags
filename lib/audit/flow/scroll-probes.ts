import type { Page } from 'playwright'

export interface GhostSectionProbeResult {
  ghostCount: number
  sampleSelector: string | null
  sampleText: string | null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Scroll the page and detect sections that remain invisible in the viewport. */
export async function probeGhostSections(page: Page): Promise<GhostSectionProbeResult> {
  const viewport = page.viewportSize()
  const vh = viewport?.height ?? 800
  const seen = new Map<string, string>()

  // Check at each scroll stop, not just the last one - a section scrolled out of
  // view by the time we reach the bottom would never be inspected otherwise, so
  // ghosting in the upper 3/4 of a long page went completely undetected before.
  for (const scrollY of [0, vh, vh * 2, vh * 3]) {
    await page.evaluate((y) => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      window.scrollTo(0, y)
    }, scrollY)
    await sleep(500)

    const stepGhosts = await page.evaluate(() => {
      ;(globalThis as unknown as { __name?: (fn: unknown, name?: string) => unknown }).__name ??= (fn) => fn
      const ghosts: Array<{ selector: string; text: string }> = []
      const candidates = document.querySelectorAll('main section, main article, section.demo-feature-card')

      for (const el of candidates) {
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue

        const style = window.getComputedStyle(el)
        const opacity = parseFloat(style.opacity)
        const transform = style.transform
        let translateY = 0
        if (transform && transform !== 'none') {
          const match = transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^)]+)\)/)
          if (match) translateY = Math.abs(parseFloat(match[1]))
          const match3d = transform.match(/translateY\(([^)]+)\)/)
          if (match3d) translateY = Math.max(translateY, Math.abs(parseFloat(match3d[1])))
        }

        const isGhost = opacity < 0.1 || translateY > 20
        if (!isGhost) continue

        const text = (el.textContent ?? '').trim().slice(0, 60)
        let selector = el.tagName.toLowerCase()
        if (el.id) selector = `#${el.id}`
        else if (el.className) {
          const cls = el.className.toString().split(/\s+/)[0]
          if (cls) selector = `.${cls}`
        }
        ghosts.push({ selector, text })
      }

      return ghosts
    })

    for (const ghost of stepGhosts) {
      if (!seen.has(ghost.selector)) seen.set(ghost.selector, ghost.text)
    }
  }

  const ghosts = [...seen.entries()].map(([selector, text]) => ({ selector, text }))
  return {
    ghostCount: ghosts.length,
    sampleSelector: ghosts[0]?.selector ?? null,
    sampleText: ghosts[0]?.text ?? null,
  }
}
