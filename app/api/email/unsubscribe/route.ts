import { boundedText } from '@/lib/security/bounded-body'
import { readUnsubscribeToken, unsubscribeProductTips } from '@/lib/email/unsubscribe'
import { emailButtonStyle, emailLayout, escapeEmailHtml } from '@/lib/email/layout'
import { NOTIFICATIONS_COPY as C } from '@/lib/marketing/copy/notifications'
import { getAppUrl } from '@/lib/get-app-url'

const responseHeaders = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }

function result(content: string, status = 200) { return new Response(emailLayout(content), { status, headers: responseHeaders }) }
const manage = () => `<p><a href="${escapeEmailHtml(getAppUrl())}/settings#email-updates">${C.unsubscribe.manage}</a></p>`

/** Link scanners may GET this URL. Only a deliberate POST changes preferences. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!readUnsubscribeToken(token)) return result(`<p>${C.unsubscribe.invalid}</p>${manage()}`, 400)
  const action = `${getAppUrl()}/api/email/unsubscribe?token=${encodeURIComponent(token)}`
  return result(`<h1>${C.unsubscribe.title}</h1><p>${C.unsubscribe.body}</p><form action="${escapeEmailHtml(action)}" method="post"><input type="hidden" name="confirm" value="stop"><button type="submit" style="${emailButtonStyle}border:0;cursor:pointer;">${C.unsubscribe.action}</button></form>${manage()}`)
}

/** RFC 8058 requests need no session, cookies or redirect. The signed token
 * authorizes only disabling product tips for the original account address. */
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!readUnsubscribeToken(token)) return result(`<p>${C.unsubscribe.invalid}</p>${manage()}`, 400)
  let form: FormData
  try {
    const body = await boundedText(request.body, 8192)
    form = await new Request(request.url, { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') ?? '' }, body }).formData()
  } catch { return result(`<p>${C.unsubscribe.invalid}</p>${manage()}`, 400) }
  if (form.get('List-Unsubscribe') !== 'One-Click' && form.get('confirm') !== 'stop')
    return result(`<p>${C.unsubscribe.invalid}</p>${manage()}`, 400)
  try { await unsubscribeProductTips(token) }
  catch { return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
  return result(`<h1>${C.unsubscribe.doneTitle}</h1><p>${C.unsubscribe.done}</p>${manage()}`)
}
