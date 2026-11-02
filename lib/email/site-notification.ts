import { getAppUrl } from '@/lib/get-app-url'
import { brandLight } from '@/lib/design/brand-spec'
import { NOTIFICATION_EMAIL_COPY as C } from '@/lib/marketing/copy/notification-emails'
import { emailButtonStyle, emailLayout, escapeEmailHtml, formatEmailDate } from './layout'
import { emailContent } from './content'
import { emailChangeBlock, emailNotificationHeading } from './notification-parts'

type Finding = { id?: string; problem?: string }
export function siteNotificationEmail(input: {
  projectId: string; url: string; name: string | null; checkedAt: Date | null;
  regressions: Finding[]; recoveries: Finding[];
}) {
  const host = new URL(input.url).hostname
  const appUrl = getAppUrl()
  const href = (id?: string) => `${appUrl}/sites/${encodeURIComponent(input.projectId)}/flags${id ? `/${encodeURIComponent(id)}` : ''}?source=watch-email`
  const leadFlag = [...input.regressions, ...input.recoveries].find(flag => flag.id)
  const heading = C.heading(input.regressions.length, input.recoveries.length)
  const greeting = C.greeting(input.name?.slice(0, 120) ?? null)
  const checked = input.checkedAt ? C.checked(formatEmailDate(input.checkedAt)) : ''
  const visibleRegressions = input.regressions.slice(0, 8)
  const visibleRecoveries = input.recoveries.slice(0, 8 - visibleRegressions.length)
  const remaining = input.regressions.length + input.recoveries.length - visibleRegressions.length - visibleRecoveries.length
  const preferencesUrl = `${appUrl}/sites/${encodeURIComponent(input.projectId)}/settings`
  const regressions = visibleRegressions.map(flag => emailChangeBlock({
    now: { text: flag.problem?.slice(0, 240) || C.missingProblem, href: href(flag.id) },
  })).join('')
  const recoveries = visibleRecoveries.map(flag => emailChangeBlock({
    before: { label: C.before, text: flag.problem?.slice(0, 240) || C.previousProblem, href: href(flag.id) },
    now: { label: C.now, text: C.recoveredResult }, improved: true,
  })).join('')
  const section = (title: string, content: string) => content
    ? `<h2 style="margin:28px 0 8px;font-size:16px;">${title}</h2>${content}` : ''
  const mixed = Boolean(regressions && recoveries)
  const action = leadFlag?.id ? C.evidence : C.flags
  const html = emailLayout(`<p style="margin:0 0 24px;">${escapeEmailHtml(greeting)}</p>${emailNotificationHeading(host, heading)}${mixed ? section(C.attention, regressions) + section(C.recovery, recoveries) : regressions + recoveries}${remaining ? `<p>${C.more(remaining)}</p>` : ''}${checked ? `<p style="font-size:13px;color:${brandLight.mutedForeground};">${escapeEmailHtml(checked)}</p>` : ''}<p style="margin:24px 0 0;"><a href="${escapeEmailHtml(href(leadFlag?.id))}" style="${emailButtonStyle}">${action}</a></p>`, { preview: heading, preferencesUrl })
  return {
    subject: C.subject(host, input.regressions.length, input.recoveries.length),
    ...emailContent(html),
  }
}
