import type { Frame, Page } from 'playwright'
import { z } from 'zod'
import { sleep } from '@/lib/utils/sleep'
import { observeViewport } from '../browser/viewport-observation'
import { readLoadingUi } from '../browser/loading-ui'

export const postClickMetricsSchema = z.object({
  version: z.literal(2).optional(), timeToFirstContentMs: z.number().nonnegative().nullable(),
  stuckLoading: z.boolean().nullable(), blankScreenMs: z.number().nonnegative().nullable(), stuckLoadingLabel: z.string().max(160).nullable(),
  contentComplete: z.boolean().optional(), loadingComplete: z.boolean().optional(), observedForMs: z.number().nonnegative().optional(),
  contentAbsentThroughMs: z.number().nonnegative().optional(), pageUrl: z.string().url().optional(),
}).strict()
export type PostClickMetrics = z.infer<typeof postClickMetricsSchema>
const unavailable = (): PostClickMetrics => ({ version: 2, timeToFirstContentMs: null, blankScreenMs: null,
  stuckLoading: null, stuckLoadingLabel: null, contentComplete: false, loadingComplete: false, observedForMs: 0 })

/** Poll the reached viewport. Content arrival is relative to the click; blank
 * observations begin at document commit. Missing samples never become timings. */
export async function measurePostClickLoading(page: Page, windowMs = 8_000,
  options: { startedAt?: number; deadline?: number; signal?: AbortSignal } = {},
): Promise<PostClickMetrics> {
  const startedAt = options.startedAt ?? Date.now(), committedAt = Date.now()
  const until = Math.min(committedAt + windowMs, options.deadline ?? Infinity), url = page.url()
  const result = unavailable()
  result.pageUrl = url
  result.contentAbsentThroughMs = 0
  let loadingSince: number | null = null
  while (!options.signal?.aborted && Date.now() < until && !page.isClosed()) {
    const [viewport, loading] = await Promise.all([
      observeViewport(page, { profile: 'post-click-v2', includeActions: false, excludeLoading: true }).catch(() => null),
      readLoadingUi(page).catch(() => null),
    ])
    const sampledAt = Date.now()
    if (page.url() !== url) return { ...unavailable(), pageUrl: page.url() }
    if (options.signal?.aborted || sampledAt > until) break
    result.observedForMs = Math.max(0, sampledAt - startedAt)
    if (viewport?.pageUrl === url) {
      if (viewport.content && result.timeToFirstContentMs === null) {
        result.timeToFirstContentMs = Math.max(0, sampledAt - startedAt)
        result.blankScreenMs ??= 0
        result.contentComplete = result.timeToFirstContentMs <= 3000 || result.contentAbsentThroughMs > 3000
      } else if (!viewport.content && viewport.contentComplete && result.timeToFirstContentMs === null) {
        result.blankScreenMs = Math.max(0, sampledAt - committedAt)
        result.contentAbsentThroughMs = Math.max(0, sampledAt - startedAt)
        result.contentComplete = result.contentAbsentThroughMs > 3000
      }
    }
    if (loading && viewport?.pageUrl === url) {
      if (loading.loadingVisible) {
        loadingSince ??= sampledAt
        result.stuckLoadingLabel = loading.loadingLabel
        if (result.stuckLoading !== true) { result.stuckLoading = null; result.loadingComplete = false }
        if (sampledAt - loadingSince >= 2000) { result.stuckLoading = true; result.loadingComplete = true }
      } else {
        loadingSince = null
        result.stuckLoading ??= false
        result.loadingComplete = true
      }
    } else {
      loadingSince = null
      if (result.stuckLoading !== true) { result.stuckLoading = null; result.loadingComplete = false }
    }
    if (result.timeToFirstContentMs !== null && loading && !loading.loadingVisible) break
    await sleep(Math.min(100, Math.max(0, until - Date.now())))
  }
  return result
}

/** Start at the actual main-frame commit while the click/navigation call is
 * still pending. The caller owns cancellation on errors and page disposal. */
export function startPostClickObservation(page: Page, options: { expectNavigation: boolean; deadline: number }) {
  const startedAt = Date.now(), controller = new AbortController()
  let work: Promise<PostClickMetrics> | undefined
  let committedAt: number | undefined, committedUrl: string | undefined
  const begin = () => {
    if (!work && !controller.signal.aborted) {
      committedAt = Date.now(); committedUrl = page.url()
      work = measurePostClickLoading(page, 8_000, { startedAt, deadline: options.deadline, signal: controller.signal })
      void work.catch(() => undefined)
    }
  }
  const navigated = (frame: Frame) => { if (frame === page.mainFrame()) begin() }
  const cancel = () => {
    controller.abort()
    page.off('framenavigated', navigated)
    page.off('close', cancel)
  }
  page.on('framenavigated', navigated)
  page.once('close', cancel)
  return {
    afterClick() { if (!options.expectNavigation) begin() },
    cancel,
    async finish(documentNavigation = false) {
      if (!options.expectNavigation) begin()
      try {
        const observed = work ? await work : unavailable()
        // Same-document URL changes do not prove that content was absent before
        // the frame event. Only an actual response supplies this lower bound.
        if (documentNavigation && committedAt !== undefined && observed.pageUrl === committedUrl && page.url() === committedUrl) {
          observed.contentAbsentThroughMs = Math.max(observed.contentAbsentThroughMs ?? 0, committedAt - startedAt)
          observed.contentComplete ||= observed.contentAbsentThroughMs > 3000
        }
        return observed
      } finally { cancel() }
    },
  }
}
