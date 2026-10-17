import { getAuditBrowser } from '@/lib/audit/screenshot'
import { captureAccessibilityTree } from '@/lib/audit/browser/journey-safety'
import { discoverJourneyLinks } from './discover'
import { planJourney } from './planner'
import type { ProductContract } from '@/lib/audit/product-contract'
import type { ScanAccessConfig } from '@/lib/audit/scan-access'

/** Collect this planner's actual page facts and close its private browser context. */
export async function observeJourneyPlan(startUrl: string, contract: ProductContract | null,
  scanAccess: ScanAccessConfig | null | undefined, remainingBudget: () => number) {
  const browserForPlan = await getAuditBrowser()
  const planSession = await (
    await import('@/lib/audit/browser/page-session')
  ).createAuditPage(browserForPlan, startUrl, {
    profile: (await import('@/lib/audit/browser/capture-profile')).DESKTOP_CAPTURE_PROFILE,
    journeySafe: true,
    scanAccess,
  })
  try {
    const origin = new URL(startUrl).origin
    const [initialTree, links] = await Promise.all([
      captureAccessibilityTree(planSession.page),
      discoverJourneyLinks(planSession.page, origin),
    ])
    const planResult = await planJourney(
      {
        url: startUrl,
        contract,
        initialTree,
        metadata: {
          title: await planSession.page.title(),
          description: await planSession.page.evaluate(
            () =>
              document.querySelector('meta[name="description"]')?.getAttribute('content') ?? ''
          ),
          h1s: await planSession.page.evaluate(() =>
            Array.from(document.querySelectorAll('h1'))
              .map((h) => (h.textContent ?? '').trim())
              .filter(Boolean)
          ),
        },
        links,
      },
      remainingBudget()
    )
    return planResult
  } finally {
    planSession.disposeNetwork()
    await planSession.page.context().close().catch(() => {})
  }

}
