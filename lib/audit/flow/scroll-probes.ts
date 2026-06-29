import type { Page } from 'puppeteer'

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
  const viewport = page.viewport()
  const vh = viewport?.height ?? 800

  for (const scrollY of [0, vh, vh * 2, vh * 3]) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY)
    await sleep(500)
  }

  // Extra wait for scroll-triggered animations to settle
  await sleep(500)

  const result = await page.evaluate(() => {
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

    return {
      ghostCount: ghosts.length,
      sample: ghosts[0] ?? null,
    }
  })

  return {
    ghostCount: result.ghostCount,
    sampleSelector: result.sample?.selector ?? null,
    sampleText: result.sample?.text ?? null,
  }
}
