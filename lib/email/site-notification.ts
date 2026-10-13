import { SITE_URL } from '@/lib/marketing/copy/brand'
import { brandLight } from '@/lib/design/brand-spec'
import { NOTIFICATION_EMAIL_COPY as C } from '@/lib/marketing/copy/notification-emails'
import { emailButtonStyle, emailLayout, escapeEmailHtml } from './layout'

type Finding = { id?: string; problem?: string }
export function siteNotificationEmail(input: {
  projectId: string; url: string; name: string | null; checkedAt: Date | null;
  regressions: Finding[]; recoveries: Finding[];
}) {
  const host = new URL(input.url).hostname
  const href = (id?: string) => `${SITE_URL}/sites/${encodeURIComponent(input.projectId)}/flags${id ? `/${encodeURIComponent(id)}` : ''}?source=watch-email`
  const leadFlag = [...input.regressions, ...input.recoveries].find(flag => flag.id)
  const lead = C.lead(host, input.regressions.length, input.recoveries.length)
  const greeting = `Hi${input.name ? ` ${input.name}` : ''},`
  const checked = input.checkedAt ? C.checked(input.checkedAt.toISOString()) : ''
  const rows = (findings: Finding[], heading: string) => findings.length
    ? `<h2 style="font-size:16px;">${heading}</h2><ul>${findings.filter(flag => flag.problem).map(flag => `<li><a href="${escapeEmailHtml(href(flag.id))}" style="color:${brandLight.link};">${escapeEmailHtml(flag.problem!)}</a></li>`).join('')}</ul>` : ''
  const textRows = (findings: Finding[], heading: string) => findings.length
    ? `\n${heading}\n${findings.filter(flag => flag.problem).map(flag => `- ${flag.problem}\n  ${href(flag.id)}`).join('\n')}\n` : ''
  return {
    subject: C.subject(host, input.regressions.length),
    html: emailLayout(`<p>${escapeEmailHtml(greeting)}</p><p>${escapeEmailHtml(lead)}</p>${rows(input.regressions, C.attention)}${rows(input.recoveries, C.recovery)}${checked ? `<p>${escapeEmailHtml(checked)}</p>` : ''}<p><a href="${escapeEmailHtml(href(leadFlag?.id))}" style="${emailButtonStyle}">${leadFlag?.id ? C.evidence : C.flags}</a></p>`),
    text: `${greeting}\n\n${lead}\n${textRows(input.regressions, C.attention)}${textRows(input.recoveries, C.recovery)}\n${checked}\n${C.evidence}: ${href(leadFlag?.id)}`,
  }
}
