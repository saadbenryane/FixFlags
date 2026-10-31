import { getAppUrl } from '@/lib/get-app-url'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'
import { NOTIFICATION_EMAIL_COPY } from '@/lib/marketing/copy/notification-emails'
import { emailButtonStyle, emailLayout, escapeEmailHtml, formatEmailDate } from './layout'

export function uptimeNotificationEmail(input: { projectId: string; url: string; kind: 'DOWN' | 'RECOVERED'; at: Date }) {
  const host = new URL(input.url).hostname
  const href = `${getAppUrl()}/sites/${encodeURIComponent(input.projectId)}?view=timeline`
  const preferencesUrl = `${getAppUrl()}/sites/${encodeURIComponent(input.projectId)}/settings`
  const C = UPTIME_COPY.email
  const subject = input.kind === 'DOWN' ? C.downSubject(host) : C.recoverySubject(host)
  const body = input.kind === 'DOWN' ? C.downBody(input.url, formatEmailDate(input.at))
    : C.recoveryBody(input.url, formatEmailDate(input.at))
  return { subject, text: `${body}\n\n${C.action}: ${href}\n${NOTIFICATION_EMAIL_COPY.preferences}: ${preferencesUrl}`,
    html: emailLayout(`<h1 style="font-size:24px;line-height:1.3;">${escapeEmailHtml(subject)}</h1>${body.split('\n\n').map(paragraph => `<p>${escapeEmailHtml(paragraph)}</p>`).join('')}<p><a href="${escapeEmailHtml(href)}" style="${emailButtonStyle}">${C.action}</a></p>`,
      { preview: subject, preferencesUrl }) }
}
