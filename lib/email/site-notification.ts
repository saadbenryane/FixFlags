import { getAppUrl } from '@/lib/get-app-url'
import { brandLight } from '@/lib/design/brand-spec'
import { NOTIFICATION_EMAIL_COPY as C } from '@/lib/marketing/copy/notification-emails'
import { emailButtonStyle, emailLayout, escapeEmailHtml, formatEmailDate } from './layout'

type Finding = { id?: string; problem?: string }
export function siteNotificationEmail(input: {
  projectId: string; url: string; name: string | null; checkedAt: Date | null;
  regressions: Finding[]; recoveries: Finding[];
}) {
  const host = new URL(input.url).hostname
  const appUrl = getAppUrl()
  const href = (id?: string) => `${appUrl}/sites/${encodeURIComponent(input.projectId)}/flags${id ? `/${encodeURIComponent(id)}` : ''}?source=watch-email`
  const leadFlag = [...input.regressions, ...input.recoveries].find(flag => flag.id)
  const lead = C.lead(host, input.regressions.length, input.recoveries.length)
  const greeting = `Hi${input.name ? ` ${input.name.slice(0, 120)}` : ''},`
  const checked = input.checkedAt ? C.checked(formatEmailDate(input.checkedAt)) : ''
  const visibleRegressions = input.regressions.slice(0, 8)
  const visibleRecoveries = input.recoveries.slice(0, 8 - visibleRegressions.length)
  const remaining = input.regressions.length + input.recoveries.length - visibleRegressions.length - visibleRecoveries.length
  const preferencesUrl = `${appUrl}/sites/${encodeURIComponent(input.projectId)}/settings`
  const rows = (findings: Finding[], heading: string) => findings.length
    ? `<h2 style="margin:24px 0 8px;font-size:16px;">${heading}</h2><ul style="padding-left:20px;">${findings.filter(flag => flag.problem).map(flag => `<li style="margin:0 0 12px;"><a href="${escapeEmailHtml(href(flag.id))}" style="color:${brandLight.link};">${escapeEmailHtml(flag.problem!.slice(0, 240))}</a></li>`).join('')}</ul>` : ''
  const textRows = (findings: Finding[], heading: string) => findings.length
    ? `\n${heading}\n${findings.filter(flag => flag.problem).map(flag => `- ${flag.problem!.slice(0, 240)}\n  ${href(flag.id)}`).join('\n')}\n` : ''
  return {
    subject: C.subject(host, input.regressions.length),
    html: emailLayout(`<p>${escapeEmailHtml(greeting)}</p><h1 style="font-size:24px;line-height:1.3;">${escapeEmailHtml(lead)}</h1>${input.regressions.length ? `<p>${C.nextStep}</p>` : ''}${rows(visibleRegressions, C.attention)}${rows(visibleRecoveries, C.recovery)}${remaining ? `<p>${C.more(remaining)}</p>` : ''}${checked ? `<p style="font-size:13px;color:${brandLight.mutedForeground};">${escapeEmailHtml(checked)}</p>` : ''}<p><a href="${escapeEmailHtml(href(leadFlag?.id))}" style="${emailButtonStyle}">${leadFlag?.id ? C.evidence : C.flags}</a></p>`, { preview: lead, preferencesUrl }),
    text: `${greeting}\n\n${lead}\n${input.regressions.length ? C.nextStep : ''}\n${textRows(visibleRegressions, C.attention)}${textRows(visibleRecoveries, C.recovery)}\n${remaining ? C.more(remaining) : ''}\n${checked}\n${C.evidence}: ${href(leadFlag?.id)}\n${C.preferences}: ${preferencesUrl}`,
  }
}
