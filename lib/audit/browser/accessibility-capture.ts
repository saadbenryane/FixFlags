import { createHash } from 'node:crypto'
import { AxeBuilder } from '@axe-core/playwright'
import type { AxeResults } from 'axe-core'
import type { Frame, Page } from 'playwright'
import { ACCESSIBILITY_RUN_OPTIONS, AXE_POLICY_CHECK_IDS, axeRuleToCheckId, isIframeAxeTarget, MOBILE_ACCESSIBILITY_RULE_IDS, type AxeTarget } from '../checks/accessibility-rules'
import { recordedAxeViolations, summarizeAccessibility, type AccessibilityEvidence } from './accessibility-evidence'
import type { CaptureObservationScope } from './observation-scope'

/** Bind a responsibility to the embedded documents in which axe actually
 * inspected applicable nodes. A frame element alone proves no such coverage. */
async function measureEmbeddedScopes(page: Page, results: AxeResults): Promise<AccessibilityEvidence['embeddedScopes']> {
  const groups = new Map<string, Map<string, number>>()
  const paths = new Map<string, { index: number; chain: AxeTarget }>()
  for (const rule of [...results.violations, ...results.incomplete, ...results.passes]) {
    const checkId = axeRuleToCheckId(rule.id)
    if (!AXE_POLICY_CHECK_IDS.some(id => id === checkId)) continue
    for (const { target } of rule.nodes) {
      if (!isIframeAxeTarget(target)) continue
      const chain = target.slice(0, -1)
      const path = JSON.stringify(chain)
      let frame = paths.get(path)
      if (!frame) {
        if (path.length > 4000 || paths.size >= 64) return undefined
        frame = { index: paths.size, chain }
        paths.set(path, frame)
      }
      const group = groups.get(checkId) ?? new Map<string, number>()
      group.set(JSON.stringify([rule.id, path]), frame.index)
      groups.set(checkId, group)
    }
  }
  if (!paths.size) return undefined
  const resolved = await page.evaluate(chains => chains.map(chain => {
    let doc: Document = document
    const urls: string[] = []
    try {
      for (const part of chain) {
        let root: Document | ShadowRoot = doc
        let element: Element | undefined
        const selectors = typeof part === 'string' ? [part] : part
        for (const [index, selector] of selectors.entries()) {
          const matches: NodeListOf<Element> = root.querySelectorAll(selector)
          if (matches.length !== 1) return null
          const match = matches[0]
          element = match
          if (index < selectors.length - 1) {
            if (!match.shadowRoot) return null
            root = match.shadowRoot
          }
        }
        const view = doc.defaultView
        if (!view || !(element instanceof view.HTMLIFrameElement || element instanceof view.HTMLFrameElement) ||
          !element.contentDocument) return null
        doc = element.contentDocument
        if (doc.URL.length > 4000) return null
        urls.push(doc.URL)
      }
      return urls
    } catch {
      return null
    }
  }), [...paths.values()].map(frame => frame.chain))
  return Object.fromEntries([...groups].flatMap(([checkId, entries]) => {
    const documents = [...entries.keys()].sort().map(entry => [entry, resolved[entries.get(entry)!]])
    if (documents.some(([, urls]) => !urls)) return []
    const identity = createHash('sha256').update(JSON.stringify(documents)).digest('hex')
    return [[checkId, identity]]
  }))
}

export async function collectAccessibilityEvidence(page: Page, scope: Omit<CaptureObservationScope, 'finalUrl'>, device: 'desktop' | 'mobile') {
  const finalUrl = page.url()
  let pageChanged = false
  let frameChanged = false
  const markNavigation = (frame: Frame) => {
    if (frame === page.mainFrame()) pageChanged = true
    else frameChanged = true
  }
  const markFrameChange = () => { frameChanged = true }
  page.on('framenavigated', markNavigation)
  page.on('frameattached', markFrameChange)
  page.on('framedetached', markFrameChange)
  try {
    // Legacy mode keeps axe's analysis inside same-origin documents.
    const builder = new AxeBuilder({ page }).setLegacyMode(true)
    const results = await (device === 'mobile' ? builder.withRules([...MOBILE_ACCESSIBILITY_RULE_IDS]) : builder.options(ACCESSIBILITY_RUN_OPTIONS)).analyze()
    const embeddedScopes = frameChanged ? undefined : await measureEmbeddedScopes(page, results).catch(() => undefined)
    if (pageChanged || page.url() !== finalUrl || results.url !== finalUrl) throw new Error('Document changed during accessibility inspection')
    const evidence = summarizeAccessibility(results, { ...scope, finalUrl })
    if (!frameChanged && embeddedScopes && Object.keys(embeddedScopes).length) evidence.embeddedScopes = embeddedScopes
    return { evidence, violations: recordedAxeViolations(results) }
  } finally {
    page.off('framenavigated', markNavigation)
    page.off('frameattached', markFrameChange)
    page.off('framedetached', markFrameChange)
  }
}
