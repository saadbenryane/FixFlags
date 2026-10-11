import { z } from 'zod'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { MAX_WATCH_MINUTES, watchIntervalSchema } from './watch-schedule'

export class SiteActionError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'SiteActionError' }
}

const actionResponse = z.object({
  ok: z.boolean().optional(), message: z.string().optional(), error: z.string().optional(), code: z.string().optional(),
  authorizeUrl: z.string().url().refine(url => new URL(url).protocol === 'https:').optional(),
  interval: watchIntervalSchema.nullable().optional(),
  everyMinutes: z.number().int().min(60).max(MAX_WATCH_MINUTES).multipleOf(60).optional(),
}).passthrough().superRefine((body, context) => {
  if (body.interval === 'custom' && body.everyMinutes === undefined) context.addIssue({ code: 'custom', message: 'Missing custom schedule timing', path: ['everyMinutes'] })
})

export async function fetchSiteAction(url: string, options?: RequestInit): Promise<Response> {
  try { return await fetch(url, options) }
  catch { throw new SiteActionError(SITE_ACTION_COPY.interrupted) }
}

/** Validate the shared envelope before any success message or navigation. */
export async function readSiteActionResponse(response: Response) {
  const raw: unknown = await response.json().catch(() => null)
  const parsed = actionResponse.safeParse(raw)
  if (response.status === 401) throw new SiteActionError(parsed.success ? parsed.data.message ?? parsed.data.error ?? SITE_ACTION_COPY.signIn : SITE_ACTION_COPY.signIn, 401)
  if (!parsed.success) throw new SiteActionError(SITE_ACTION_COPY.invalidResponse, response.status)
  return { ...parsed.data, error: parsed.data.message ?? parsed.data.error }
}

export function siteActionMessage(error: unknown) {
  return error instanceof SiteActionError ? error.message : SITE_ACTION_COPY.invalidResponse
}
