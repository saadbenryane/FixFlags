import { getAppUrl } from '@/lib/get-app-url'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'
import { NOTIFICATION_EMAIL_COPY } from '@/lib/marketing/copy/notification-emails'
import { brandLight } from '@/lib/design/brand-spec'
import { emailButtonStyle, emailLayout, escapeEmailHtml, formatEmailDate } from './layout'
import { emailContent } from './content'
import { emailChangeBlock, emailNotificationHeading } from './notification-parts'

export function uptimeNotificationEmail(input: { projectId: string; url: string; kind: 'DOWN' | 'RECOVERED'; at: Date }) {
  const host = new URL(input.url).hostname
  const href = `${getAppUrl()}/sites/${encodeURIComponent(input.projectId)}?view=timeline`
  const preferencesUrl = `${getAppUrl()}/sites/${encodeURIComponent(input.projectId)}/settings`
  const C = UPTIME_COPY.email
  const subject = input.kind === 'DOWN' ? C.downSubject(host) : C.recoverySubject(host)
  const recovered = input.kind === 'RECOVERED'
  const comparison = emailChangeBlock({
    ...(recovered ? { before: { label: C.before, text: C.unreachable } } : {}),
    now: { label: C.now, text: recovered ? C.recoveryResult : C.downResult }, improved: recovered,
  })
  const html = emailLayout(`${emailNotificationHeading(input.url, recovered ? C.recoveryHeading : C.downHeading)}${comparison}${!recovered ? `<p>${C.nextStep}</p>` : ''}<p style="font-size:13px;color:${brandLight.mutedForeground};">${escapeEmailHtml(NOTIFICATION_EMAIL_COPY.checked(formatEmailDate(input.at)))}</p><p style="margin:24px 0 0;"><a href="${escapeEmailHtml(href)}" style="${emailButtonStyle}">${C.action}</a></p><p style="margin:20px 0 0;font-size:13px;color:${brandLight.mutedForeground};">${C.scope}</p>`,
    { preview: subject, preferencesUrl })
  return { subject, ...emailContent(html) }
}
