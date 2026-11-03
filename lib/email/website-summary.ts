import { getAppUrl } from '@/lib/get-app-url'
import { brandLight } from '@/lib/design/brand-spec'
import { NOTIFICATIONS_COPY as C } from '@/lib/marketing/copy/notifications'
import { NOTIFICATION_EMAIL_COPY } from '@/lib/marketing/copy/notification-emails'
import { emailButtonStyle, emailLayout, escapeEmailHtml as escape, formatEmailDate } from './layout'

export type SummarySite = {
  id: string; url: string; problems: number; checkedAt: Date | null;
  incomplete: boolean; failed: boolean; unchanged: boolean; offline: boolean;
  urgentOnly?: boolean;
  stale?: boolean;
}
export function websiteSummaryEmail(input: {
  cadence: 'DAILY' | 'WEEKLY'; sites: SummarySite[]; totalSites: number; timeZone: string; asOf: Date;
}) {
  const app = getAppUrl(), dashboard = `${app}/dashboard`, preferencesUrl = `${app}/settings#email-updates`
  const period = C.summary.period(formatEmailDate(input.asOf, input.timeZone))
  const summary = (site: SummarySite) => [
    site.offline ? C.summary.offline : null,
    site.problems ? (site.urgentOnly ? C.summary.urgentProblems : C.summary.problems)(site.problems)
      : !site.checkedAt || site.incomplete || site.failed || site.offline || site.stale ? null : site.urgentOnly ? C.summary.quietUrgent : C.summary.quiet,
    !site.checkedAt ? C.summary.missing : null,
    site.failed ? C.summary.failed : site.incomplete && site.checkedAt ? C.summary.incomplete : null,
    site.stale ? C.summary.stale : null,
    site.checkedAt ? C.summary.checked(formatEmailDate(site.checkedAt, input.timeZone)) : null,
    site.unchanged && site.checkedAt ? C.summary.old : null,
  ].filter(Boolean).join(' ')
  const href = (site: SummarySite) => `${app}/sites/${encodeURIComponent(site.id)}?source=summary-email`
  const sites = input.sites.slice(0, 20)
  const more = input.totalSites > sites.length ? C.summary.more(input.totalSites - sites.length) : ''
  return {
    subject: C.summary.subject(input.cadence),
    html: emailLayout(`<h1 style="font-size:26px;line-height:1.25;">${C.summary.heading}</h1><p>${C.summary.intro}</p><p style="font-size:13px;color:${brandLight.mutedForeground};">${escape(period)}</p>${sites.map(site => `<table role="presentation" style="width:100%;margin:16px 0;background:${brandLight.muted};border-radius:12px;"><tr><td style="padding:20px;"><h2 style="margin:0 0 8px;font-size:18px;">${escape(new URL(site.url).hostname)}</h2><p style="margin:0 0 12px;">${escape(summary(site))}</p><a href="${escape(href(site))}" style="color:${brandLight.link};">${C.summary.siteAction}</a></td></tr></table>`).join('')}${more ? `<p>${more}</p>` : ''}<p><a href="${escape(dashboard)}" style="${emailButtonStyle}">${C.summary.action}</a></p>`, { preview: C.summary.intro, preferencesUrl }),
    text: `${C.summary.heading}\n\n${C.summary.intro}\n${period}\n\n${sites.map(site => `${new URL(site.url).hostname}\n${summary(site)}\n${C.summary.siteAction}: ${href(site)}`).join('\n\n')}\n\n${more}\n${C.summary.action}: ${dashboard}\n${NOTIFICATION_EMAIL_COPY.preferences}: ${preferencesUrl}`,
  }
}
