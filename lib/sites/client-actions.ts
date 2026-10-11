import { agentReplySchema } from './agent-contract'
import { z } from 'zod'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { MAX_WATCH_MINUTES, watchIntervalSchema } from './watch-schedule'
import { outcomeFixtureViewSchema } from './domain/safe-form'

export class SiteActionError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) { super(message); this.name = 'SiteActionError' }
}

const watchWrite = z.object({
  ok: z.literal(true), interval: watchIntervalSchema.nullable(), requested: watchIntervalSchema.nullable().optional(),
  code: z.string().optional(), message: z.string().optional(),
  everyMinutes: z.number().int().min(60).max(MAX_WATCH_MINUTES).multipleOf(60).optional(),
}).strict().superRefine((body, context) => {
  if (body.interval === 'custom' && body.everyMinutes === undefined) context.addIssue({ code: 'custom', message: 'Missing custom schedule timing', path: ['everyMinutes'] })
})
export const siteActionSchemas = {
  agentReply: agentReplySchema,
  connectionSync: z.object({ status: z.enum(['connected', 'mismatch', 'needs_reauth', 'unavailable']), detail: z.string() }).strict(),
  acknowledgement: z.object({ ok: z.literal(true) }).strict(),
  authorize: z.object({ authorizeUrl: z.string().url().refine(url => new URL(url).protocol === 'https:') }).strict(),
  settings: z.object({ ok: z.literal(true), notificationLevel: z.enum(['FLAGS', 'CRITICAL_ONLY', 'OFF']), notifyOnRecovery: z.boolean() }).strict(),
  outcome: z.object({ ok: z.literal(true), outcome: z.object({ id: z.string().min(1), name: z.string(), kind: z.string().min(1), environment: z.string().min(1) }) }),
  watch: watchWrite,
  monitoringActivation: z.object({ ok: z.literal(true), interval: watchIntervalSchema,
    everyMinutes: z.number().int().min(60).max(MAX_WATCH_MINUTES).multipleOf(60).optional(),
    nextRunAt: z.string().datetime({ offset: true }), outcomeId: z.string().min(1),
    firstCheck: z.enum(['requested', 'unavailable']), reused: z.boolean() }).strict().superRefine((body, context) => {
    if (body.interval === 'custom' && body.everyMinutes === undefined) context.addIssue({ code: 'custom', message: 'Missing custom schedule timing', path: ['everyMinutes'] })
  }),
  fixture: z.object({ fixture: outcomeFixtureViewSchema }).strict(),
  fixtures: z.object({ fixtures: z.array(outcomeFixtureViewSchema).max(1000) }).strict(),
  run: z.object({ runId: z.string().min(1), auditId: z.string().min(1), outcomeIds: z.array(z.string().min(1)), reused: z.boolean() }).strict(),
  outcomeEnabled: z.object({ outcome: z.object({ id: z.string().min(1), enabled: z.boolean() }).passthrough(),
    verificationQueued: z.boolean(), verificationError: z.string().nullable() }).strict(),
  fixPrompt: z.object({ ok: z.literal(true), prompt: z.string().trim().min(1), handoff: z.unknown().nullable() }).strict(),
  flagVerify: z.object({ ok: z.literal(true), accepted: z.literal(true), runId: z.string().min(1),
    runRequestId: z.string().min(1), verificationAuditId: z.string().min(1), siteId: z.string().min(1),
    parentAuditId: z.string().min(1), flagId: z.string().min(1), attemptId: z.string().min(1).nullable(),
    expectedBehavior: z.string().nullable() }).strict().refine(body => body.runId === body.runRequestId, 'Verification execution identity mismatch'),
  retry: z.object({ status: z.enum(['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING', 'COMPLETED', 'FAILED']),
    auditId: z.string().min(1), runId: z.string().min(1).optional(), siteId: z.string().min(1).optional(), reused: z.boolean().optional() }).strict(),
} as const
export type SiteActionOperation = keyof typeof siteActionSchemas
const failureSchema = z.object({ message: z.string().optional(), error: z.string().optional(), code: z.string().optional() })

export async function fetchSiteAction(url: string, options?: RequestInit): Promise<Response> {
  try { return await fetch(url, options) }
  catch { throw new SiteActionError(SITE_ACTION_COPY.interrupted) }
}

/** Validate the shared envelope before any success message or navigation. */
export async function readSiteActionResponse(response: Response, operation: SiteActionOperation = 'acknowledgement') {
  const raw: unknown = await response.json().catch(() => null)
  const failure = failureSchema.safeParse(raw)
  const defaults = { authorizeUrl: undefined, interval: undefined, everyMinutes: undefined,
    code: undefined, message: undefined, error: undefined, ok: undefined }
  if (response.status === 401) throw new SiteActionError(failure.success ? failure.data.message ?? failure.data.error ?? SITE_ACTION_COPY.signIn : SITE_ACTION_COPY.signIn, 401)
  if (!response.ok) return { ...defaults, ...(failure.success ? failure.data : {}),
    error: failure.success ? failure.data.message ?? failure.data.error ?? SITE_ACTION_COPY.invalidResponse : SITE_ACTION_COPY.invalidResponse }
  const parsed = siteActionSchemas[operation].safeParse(raw)
  if (!parsed.success) throw new SiteActionError(SITE_ACTION_COPY.invalidResponse, response.status)
  return { ...defaults, ...parsed.data, error: undefined }
}

export type SiteActionCompletion<T> = { kind: 'saved' | 'saved_refresh_pending'; data: T }
  | { kind: 'refused'; error: SiteActionError } | { kind: 'busy' }

/** One synchronous submission owner, including the gap before React renders pending state. */
export function createSiteActionController(namespace?: string) {
  let pending = false
  const intents = new Map<string, string>()
  return {
    get pending() { return pending },
    requestKey(intent: string) {
      const storageKey = namespace ? `fixflags:intent:${namespace}:${intent}` : null
      let persisted: string | null = null
      try { if (storageKey && typeof sessionStorage !== 'undefined') persisted = sessionStorage.getItem(storageKey) } catch { /* In-memory ownership remains available. */ }
      const existing = intents.get(intent) ?? persisted
      if (existing) return existing
      const key = `web:${crypto.randomUUID()}`
      intents.set(intent, key)
      try { if (storageKey && typeof sessionStorage !== 'undefined') sessionStorage.setItem(storageKey, key) } catch { /* Retain the key in this controller. */ }
      return key
    },
    completeIntent(intent: string) {
      intents.delete(intent)
      try { if (namespace && typeof sessionStorage !== 'undefined') sessionStorage.removeItem(`fixflags:intent:${namespace}:${intent}`) } catch { /* The committed receipt remains authoritative. */ }
    },
    async submit<T>(mutation: () => Promise<T>, refresh?: () => Promise<unknown>, onCommitted?: (data: T) => void): Promise<SiteActionCompletion<T>> {
      if (pending) return { kind: 'busy' }
      pending = true
      try {
        const data = await mutation()
        try { onCommitted?.(data); await refresh?.() } catch { return { kind: 'saved_refresh_pending', data } }
        return { kind: 'saved', data }
      } catch (error) {
        return { kind: 'refused', error: error instanceof SiteActionError ? error : new SiteActionError(siteActionMessage(error)) }
      } finally { pending = false }
    },
  }
}

export function siteActionMessage(error: unknown) {
  return error instanceof SiteActionError ? error.message : SITE_ACTION_COPY.invalidResponse
}

/** Typed operation payload for controllers; no optional-field success envelope. */
export async function executeSiteAction<K extends SiteActionOperation>(url: string, options: RequestInit,
  operation: K): Promise<z.infer<(typeof siteActionSchemas)[K]>> {
  const response = await fetchSiteAction(url, options)
  const raw: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const failure = failureSchema.safeParse(raw)
    throw new SiteActionError(failure.success ? failure.data.message ?? failure.data.error ??
      (response.status === 401 ? SITE_ACTION_COPY.signIn : SITE_ACTION_COPY.invalidResponse)
      : response.status === 401 ? SITE_ACTION_COPY.signIn : SITE_ACTION_COPY.invalidResponse,
      response.status, failure.success ? failure.data.code : undefined)
  }
  const parsed = siteActionSchemas[operation].safeParse(raw)
  if (!parsed.success) throw new SiteActionError(SITE_ACTION_COPY.invalidResponse, response.status)
  return parsed.data as z.infer<(typeof siteActionSchemas)[K]>
}
