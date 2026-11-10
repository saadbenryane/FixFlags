import { getAppUrl } from '@/lib/get-app-url'
import { brandLight } from '@/lib/design/brand-spec'
import { NOTIFICATIONS_COPY as C } from '@/lib/marketing/copy/notifications'
import { emailContent } from './content'
import { emailButtonStyle, emailLayout, escapeEmailHtml as escape, formatEmailDate } from './layout'

export type SummarySite = {
  id: string; url: string; problems: number; checkedAt: Date | null;
  incomplete: boolean; failed: boolean; unchanged: boolean; offline: boolean;
  urgentOnly?: boolean;
  stale?: boolean;
  issuePreview?: readonly string[];
}
export function websiteSummaryEmail(input: {
  cadence: 'DAILY' | 'WEEKLY'; sites: SummarySite[]; totalSites: number; timeZone: string; asOf: Date;
}) {
  const app = getAppUrl(), dashboard = `${app}/dashboard`, preferencesUrl = `${app}/settings#email-updates`
  const period = C.summary.period(formatEmailDate(input.asOf, input.timeZone))
  const status = (site: SummarySite) => site.problems
    ? (site.urgentOnly ? C.summary.urgentProblems : C.summary.problems)(site.problems)
    : !site.checkedAt || site.incomplete || site.failed || site.offline || site.stale ? null : site.urgentOnly ? C.summary.quietUrgent : C.summary.quiet
  const details = (site: SummarySite) => [
    site.offline ? C.summary.offline : null,
    !site.checkedAt ? C.summary.missing : null,
    site.failed ? C.summary.failed : null,
    site.stale ? C.summary.stale : null,
    site.checkedAt ? C.summary.checked(formatEmailDate(site.checkedAt, input.timeZone)) : null,
    site.unchanged && site.checkedAt ? C.summary.old : null,
  ].filter(Boolean).join(' ')
  const href = (site: SummarySite) => `${app}/sites/${encodeURIComponent(site.id)}${site.problems ? '/flags' : ''}?source=summary-email`
  const sites = input.sites.slice(0, 20)
  const more = input.totalSites > sites.length ? C.summary.more(input.totalSites - sites.length) : ''
  const siteCards = sites.map(site => {
    const preview = site.problems ? [...new Set((site.issuePreview ?? []).map(label => label.replace(/\s+/g, ' ').trim()).filter(Boolean))]
      .slice(0, Math.min(3, site.problems)).map(label => label.length > 160 ? `${label.slice(0, 159).trimEnd()}…` : label) : []
    const action = site.problems ? C.summary.fixAction : C.summary.siteAction
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;background:${brandLight.muted};border-radius:16px;"><tr><td style="padding:24px 20px;overflow-wrap:anywhere;">
<h2 style="margin:0 0 8px;font-size:20px;line-height:1.3;letter-spacing:-0.3px;">${escape(new URL(site.url).hostname)}</h2>
${status(site) ? `<p style="margin:0 0 12px;font-size:16px;font-weight:600;">${escape(status(site)!)}</p>` : ''}
<p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:${brandLight.mutedForeground};">${escape(details(site))}</p>
${preview.length ? `<p style="margin:0 0 8px;font-size:13px;font-weight:600;">${C.summary.previewHeading}</p><ul style="margin:0 0 20px;padding-left:20px;">${preview.map(label => `<li style="margin:0 0 8px;font-size:15px;line-height:1.5;">${escape(label)}</li>`).join('')}</ul>` : ''}
<p style="margin:0;"><a href="${escape(href(site))}" style="${site.problems ? emailButtonStyle : `color:${brandLight.link};font-size:14px;`}">${action}</a></p>
</td></tr></table>`
  }).join('')
  const heading = C.summary.heading(input.cadence)
  const html = emailLayout([
    `<h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;letter-spacing:-0.5px;">${heading}</h1>`,
    `<p style="margin:0 0 8px;font-size:15px;">${C.summary.intro}${sites.some(site => site.problems) ? ` ${C.summary.fixIntro}` : ''}</p>`,
    `<p style="margin:0 0 28px;font-size:12px;color:${brandLight.mutedForeground};">${escape(period)}</p>`,
    siteCards,
    more ? `<p style="font-size:14px;">${more}</p>` : '',
    input.totalSites > 1 ? `<p style="margin:24px 0 0;font-size:14px;"><a href="${escape(dashboard)}" style="color:${brandLight.link};">${C.summary.action}</a></p>` : '',
  ].join(''), { preview: `${heading}. ${C.summary.intro}`, preferencesUrl })
  return { subject: summarySubject(input.cadence, input.sites), ...emailContent(html) }
}

/** The subject states the result. "No problems found" needs a fresh, complete check of every website. */
export function summarySubject(cadence: 'DAILY' | 'WEEKLY', sites: readonly SummarySite[]) {
  const problems = sites.reduce((total, site) => total + site.problems, 0)
  if (problems > 0) return C.summary.subjectProblems(cadence, problems)
  const fresh = sites.length > 0 && sites.every(site => site.checkedAt && !site.incomplete && !site.failed && !site.offline && !site.stale && !site.urgentOnly)
  return fresh ? C.summary.subjectQuiet(cadence) : C.summary.subject(cadence)
}
