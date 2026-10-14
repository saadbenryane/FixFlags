import type { Page, Locator } from 'playwright'
import { z } from 'zod'
import { assertPublicAuditUrl } from '@/lib/audit/url'
import { getAuditBrowser } from '@/lib/audit/screenshot'
import { createAuditPage, type AuditPageSession } from '@/lib/audit/browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '@/lib/audit/browser/capture-profile'
import { safeFormRequestAllowed } from '@/lib/audit/browser/safe-form-safety'
import { safeEvidenceUrl } from './contracts'

export type AccountFlow = { url: string; action: string; formIndex: number; fields: Array<{
  type: string; name: string; label: string; autocomplete: string; required: boolean; index: number }> }
export type AccountBrowser = { session: AuditPageSession; mutation: (action: 'signup' | 'login' | 'verify' | 'delete' | null, endpoint?: string) => void;
  closed: () => Promise<void>; refused: () => boolean }

export const sessionStateSchema = z.object({ cookies: z.array(z.object({ name: z.string(), value: z.string(), domain: z.string(),
  path: z.string(), expires: z.number(), httpOnly: z.boolean(), secure: z.boolean(), sameSite: z.enum(['Strict', 'Lax', 'None']) })).max(100),
  origins: z.array(z.object({ origin: z.string().url(), localStorage: z.array(z.object({ name: z.string(), value: z.string() })).max(100) })).max(10) })
export function scopedSessionState(value: unknown, origin: string) {
  const state = sessionStateSchema.parse(value), host = new URL(origin).hostname
  return { cookies: state.cookies.filter(cookie => cookie.domain.replace(/^\./, '') === host),
    origins: state.origins.filter(item => item.origin === origin) }
}
export function accountRequestAllowed(input: { url: string; method: string; navigation: boolean; origin: string; values: string[];
  action: 'signup' | 'login' | 'verify' | 'delete' | null; endpoint?: string }) {
  if (!safeFormRequestAllowed(input)) return false
  const url = new URL(input.url), path = url.pathname.toLowerCase()
  if (/(?:checkout|payment|purchase|invite|export|download)/.test(path)) return false
  const destructive = /(?:logout|sign.?out|delete|remove|destroy)/.test(path) || [...url.searchParams.entries()].some(([key, value]) => /^(?:action|command|method)$/i.test(key) && /delete|remove|destroy|logout/i.test(value))
  if (destructive && input.action !== 'delete') return false
  if (['GET', 'HEAD', 'OPTIONS'].includes(input.method.toUpperCase())) return true
  if (!input.action || url.origin !== input.origin) return false
  const actionPaths = { signup: /(?:sign.?up|register|registration)/, login: /(?:sign.?in|login|session|authenticate)/,
    verify: /(?:verify|verification|confirm|activate)/, delete: /(?:delete.?account|account.?delete|users?\/me|account\/me|profile\/delete|delete.?user)/ }
  const endpoint = input.endpoint ? new URL(input.endpoint, input.origin) : null
  if (endpoint && url.origin === endpoint.origin && url.pathname === endpoint.pathname) return true
  return actionPaths[input.action].test(path)
}

export async function openAccountBrowser(input: { url: string; origin: string; values: string[]; deadline: number;
  storageState?: unknown; retainErrorDocument?: boolean; permission: () => Promise<void> }): Promise<AccountBrowser> {
  let action: Parameters<typeof accountRequestAllowed>[0]['action'] = null, endpoint: string | undefined, refused = false, mutations = 0
  const refusedRequestUrls = new Set<string>()
  const session = await createAuditPage(await getAuditBrowser(), input.url, { profile: DESKTOP_CAPTURE_PROFILE,
    deadline: input.deadline, settle: false, retainErrorDocument: input.retainErrorDocument, readOnlyInteractions: true, refusedRequestUrls,
    ...(input.storageState ? { storageState: scopedSessionState(input.storageState, input.origin) } : {}),
    requestPolicy: async request => {
      try { await assertPublicAuditUrl(request.url) } catch { refused = true; return false }
      const permitted = accountRequestAllowed({ ...request, origin: input.origin, values: input.values, action, endpoint })
      if (!permitted) {
        if (request.navigation || !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) refused = true
        return false
      }
      const changing = !['GET', 'HEAD', 'OPTIONS'].includes(request.method)
      if (changing) {
        if (mutations > 0 || action === 'signup' && ![input.values[0], encodeURIComponent(input.values[0] ?? '')].some(value => value && (request.postData ?? '').includes(value))) {
          refused = true; return false
        }
        mutations++
      }
      if (changing || action && request.navigation) {
        try { await input.permission() } catch { refused = true; return false }
      }
      return true
    },
    configurePage: async page => {
      await page.context().addInitScript(() => {
        ;(globalThis as unknown as { __name?: (fn: unknown) => unknown }).__name ??= fn => fn
        for (const key of ['Worker', 'SharedWorker', 'WebTransport', 'RTCPeerConnection']) {
          Object.defineProperty(globalThis, key, { value: function () { throw new DOMException('Unsupported transport', 'NotAllowedError') }, configurable: false })
        }
      })
      page.on('dialog', dialog => void dialog.dismiss())
      page.on('popup', popup => void popup.close())
    } })
  session.page.setDefaultTimeout(5000)
  return { session, mutation: (next, target) => { action = next; endpoint = target; mutations = 0 }, refused: () => refused,
    closed: async () => { session.disposeNetwork(); await session.page.context().close().catch(() => undefined) } }
}
export async function emailVerificationPending(page: Page) {
  if (await page.locator('input[autocomplete="one-time-code"]:visible, input[name*="otp" i]:visible').count()) return true
  const notices = page.getByText(/verify your email|confirm your email|check your inbox|email verification required/i)
  for (let index = 0; index < Math.min(await notices.count(), 10); index++) if (await notices.nth(index).isVisible()) return true
  return false
}
export async function authenticated(page: Page) {
  if (new URL(page.url()).protocol !== 'https:') return false
  const marker = page.getByRole('button', { name: /^(?:log\s*out|sign\s*out)$/i }).or(page.getByRole('link', { name: /^(?:log\s*out|sign\s*out)$/i }))
  return await marker.first().isVisible().catch(() => false) && !await emailVerificationPending(page)
}
export async function accountLinks(page: Page, origin: string, pattern: string) {
  return page.evaluate(({ origin, pattern }) => {
    const matcher = new RegExp(pattern, 'i')
    return [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(link => matcher.test(`${link.textContent ?? ''} ${link.pathname}`) && (pattern !== '.' || !/(?:delete|remove|create|invite|purchase|checkout|log.?out|sign.?out)/i.test(link.textContent ?? '')))
      .map(link => link.href).filter(href => { try { const url = new URL(href); return url.origin === origin && !url.username && !url.password } catch { return false } }).slice(0, 24)
  }, { origin, pattern })
}
export async function readAccountForm(page: Page, purpose?: 'signup' | 'login'): Promise<AccountFlow | null> {
  const forms = await page.locator('form').count()
  for (let index = 0; index < Math.min(forms, 10); index++) {
    const form = page.locator('form').nth(index)
    if (!await form.isVisible()) continue
    const fields = await form.locator('input, textarea, select').evaluateAll(elements => elements.map((element, index) => {
      const input = element as HTMLInputElement
      return { type: input.tagName === 'INPUT' ? input.type : input.tagName.toLowerCase(), name: input.name,
        label: input.labels?.[0]?.textContent?.trim() ?? input.getAttribute('aria-label') ?? input.placeholder ?? '',
        autocomplete: input.autocomplete ?? '', required: input.required, index }
    }).filter(field => !['hidden', 'submit', 'button', 'reset'].includes(field.type)))
    if (!fields.some(field => field.type === 'email' || /email/i.test(field.name + field.label))) continue
    const submitText = await form.locator('button[type="submit"], input[type="submit"], button:not([type])').first().textContent().catch(() => '')
    const semantics = `${page.url()} ${submitText} ${fields.map(field => field.autocomplete).join(' ')}`
    if (purpose === 'signup' && !/signup|sign.up|register|registration|create.?account|new-password/i.test(semantics)) continue
    if (purpose === 'login' && !/login|log.in|sign.in|current-password/i.test(semantics)) continue
    const action = await form.getAttribute('action')
    return { url: safeEvidenceUrl(page.url()), action: new URL(action || page.url(), page.url()).href, formIndex: index, fields }
  }
  return null
}
export async function fillAccountForm(page: Page, flow: AccountFlow, email: string, password: string) {
  const form = page.locator('form').nth(flow.formIndex)
  for (const field of flow.fields) {
    const input = form.locator('input, textarea, select').nth(field.index), name = `${field.name} ${field.label} ${field.autocomplete}`
    if (!await input.isVisible()) continue
    if (field.type === 'email' || /email/i.test(name)) await input.fill(email)
    else if (field.type === 'password') await input.fill(password)
    else if (/confirm.*password/i.test(name)) await input.fill(password)
    else if (/(?:first.?name|given.?name)/i.test(name)) await input.fill('FixFlags')
    else if (/(?:last.?name|family.?name)/i.test(name)) await input.fill('Test')
    else if (/username/i.test(name)) await input.fill('ff_' + email.replace(/[^a-zA-Z0-9]/g, '').slice(-12))
    else if (/^(?:name|full.?name|display.?name)\b/i.test(name.trim())) await input.fill('FixFlags Test')
    else if (field.required && !['checkbox', 'radio'].includes(field.type)) return false
    else if (field.required && ['checkbox', 'radio'].includes(field.type)) return false
  }
  return form.evaluate(element => (element as HTMLFormElement).checkValidity())
}
export async function formSubmit(form: Locator) {
  const submit = form.locator('button[type="submit"], input[type="submit"], button:not([type])').first()
  if (!await submit.isVisible().catch(() => false)) return false
  await submit.click(); return true
}
export async function explicitAuthError(page: Page) {
  return page.getByRole('alert').filter({ hasText: /invalid (?:email|password|credentials)|incorrect password|account.*(?:not found|does not exist)|user.*not found|unable to (?:sign|log)|signup failed|registration failed|could not create/i }).first().isVisible().catch(() => false)
}
