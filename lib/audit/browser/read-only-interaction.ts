import type { Page } from 'playwright'
import { classifyTrackingEndpoint } from '../tracking/endpoints'

/** Local UI observations cannot submit data, navigate or open another window. */
export async function readOnlyInteraction(page: Page, pageUrl: string) {
  let refusals = 0
  const boundary: Parameters<Page['route']>[1] = async route => {
    const request = route.request()
    let ownPage = false
    try { ownPage = request.frame().page() === page } catch { /* No owning frame means outside this observation. */ }
    if (ownPage && classifyTrackingEndpoint(request.url(), request.resourceType(), pageUrl)?.role === 'event') {
      await route.fallback(); return
    }
    if (!ownPage || request.isNavigationRequest() || !['GET', 'HEAD', 'OPTIONS'].includes(request.method().toUpperCase())) {
      refusals++; await route.abort('blockedbyclient')
    } else await route.fallback()
  }
  const closePopup = (popup: Page) => { if (popup !== page) { refusals++; void popup.close().catch(() => undefined) } }
  const dispose = async () => {
    await page.unroute('**', boundary).catch(() => undefined)
    await page.context().unroute('**', boundary).catch(() => undefined)
    page.context().off('page', closePopup)
  }
  try {
    await page.context().route('**', boundary)
    await page.route('**', boundary)
    page.context().on('page', closePopup)
  } catch (error) { await dispose(); throw error }
  return { refusals: () => refusals, dispose }
}
