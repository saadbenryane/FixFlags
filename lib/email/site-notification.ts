import { getAppUrl } from '@/lib/get-app-url'
import { brandLight } from '@/lib/design/brand-spec'
import { NOTIFICATION_EMAIL_COPY as C } from '@/lib/marketing/copy/notification-emails'
import { emailButtonStyle, emailLayout, escapeEmailHtml, formatEmailDate } from './layout'
import { emailContent } from './content'
import { emailChangeBlock, emailNotificationHeading } from './notification-parts'
import { customerFindingLabel } from '@/lib/sites/finding-label'
import { MAX_NOTIFICATION_ATTACHMENT_BYTES } from '@/lib/sites/repair-budgets'

type Finding = { id?: string; problem?: string; checkId?: string | null; sourceAuditId?: string;
  pageUrl?: string | null; evidence?: string; whyItMatters?: string; fix?: string;
  verificationRule?: string | null; affectedPaths?: string[]; supportingObservations?: unknown;
  supportingEvidenceUnreadable?: boolean; repairPrompt?: string; repairPromptHash?: string }
export function siteNotificationEmail(input: {
  projectId: string; url: string; name: string | null; checkedAt: Date | null;
  regressions: Finding[]; recoveries: Finding[];
}) {
  if (input.regressions.length > 5000 || input.recoveries.length > 5000) throw new Error('Notification selection exceeds its source budget')
  const host = new URL(input.url).hostname
  const appUrl = getAppUrl()
  const href = (id?: string) => `${appUrl}/sites/${encodeURIComponent(input.projectId)}/flags${id ? `/${encodeURIComponent(id)}` : ''}?source=watch-email`
  const leadFlag = [...input.regressions, ...input.recoveries].find(flag => flag.id)
  const heading = C.heading(input.regressions.length, input.recoveries.length)
  const greeting = C.greeting(input.name?.slice(0, 120) ?? null)
  const checked = input.checkedAt ? C.checked(formatEmailDate(input.checkedAt)) : ''
  // Reserve bounded attachment slots for exact remaining source references.
  const visibleLimit = input.regressions.length > 8 ? 6 : 8
  const visibleRegressions = input.regressions.slice(0, visibleLimit)
  const visibleRecoveries = input.recoveries.slice(0, visibleLimit - visibleRegressions.length)
  const remaining = input.regressions.length + input.recoveries.length - visibleRegressions.length - visibleRecoveries.length
  const preferencesUrl = `${appUrl}/sites/${encodeURIComponent(input.projectId)}/settings`
  const attachments: { filename: string; content: string; contentType: 'text/plain' }[] = []
  const regressions = visibleRegressions.map((flag, index) => {
    const problem = flag.problem || C.missingProblem
    const report = flag.sourceAuditId ? `${appUrl}/report/${encodeURIComponent(flag.sourceAuditId)}` : `${appUrl}/sites/${encodeURIComponent(input.projectId)}`
    const task = flag.repairPrompt
    const prompt = task || [
      `${C.repair.report}: ${report}`, `${C.repair.finding}: ${href(flag.id)}`,
      `${flag.problem || ''}\nURL: ${flag.pageUrl || input.url}\n${C.repair.missing}`,
    ].filter(Boolean).join('\n\n')
    // Keep long evidence complete without making narrow inboxes or message clipping hide it.
    const attached = Buffer.byteLength(escapeEmailHtml(prompt)) > 5000
    const filename = `fixflags-fix-${index + 1}.txt`
    if (attached) attachments.push({ filename, content: Buffer.from(prompt).toString('base64'), contentType: 'text/plain' })
    const instructions = attached ? `<p>${escapeEmailHtml(C.repair.attachment(filename))}</p>`
      : `<p style="font-size:14px;line-height:1.5;">${escapeEmailHtml(task ? C.repair.intro : C.repair.recheckIntro)}</p><pre style="margin:12px 0 24px;padding:16px;background:${brandLight.muted};border-radius:12px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;">${escapeEmailHtml(prompt)}</pre>`
    return emailChangeBlock({ now: { text: customerFindingLabel({ ...flag, problem }), href: href(flag.id) } })
      + `<h3 style="margin:20px 0 8px;font-size:15px;">${task ? C.repair.heading : C.repair.nextSteps}</h3>${instructions}`
  }).join('')
  const recoveries = visibleRecoveries.map(flag => emailChangeBlock({
    before: { label: C.before, text: customerFindingLabel({ ...flag, problem: flag.problem || C.previousProblem }), href: href(flag.id) },
    now: { label: C.now, text: C.recoveredResult }, improved: true,
  })).join('')
  const remainderIds = input.regressions.slice(visibleRegressions.length).flatMap(flag => flag.id ? [flag.id] : [])
  const continuationFiles: string[] = []
  if (remainderIds.length) {
    // IDs are retained from this notification, never replaced by today's open list.
    let ids: string[] = []
    const headerBytes = Buffer.byteLength(C.repair.remainingPrompt(appUrl, input.projectId, []))
    const rawBudget = Math.floor(MAX_NOTIFICATION_ATTACHMENT_BYTES * 3 / 4) - 8
    let bytes = headerBytes
    const flush = () => {
      if (!ids.length) return
      const filename = `fixflags-more-fixes-${continuationFiles.length + 1}.txt`
      const prompt = C.repair.remainingPrompt(appUrl, input.projectId, ids)
      attachments.push({ filename, content: Buffer.from(prompt).toString('base64'), contentType: 'text/plain' })
      continuationFiles.push(filename)
      ids = []
      bytes = headerBytes
    }
    for (const id of remainderIds) {
      const added = Buffer.byteLength(JSON.stringify(id)) + 1
      if (headerBytes + added > rawBudget) throw new Error('Notification source reference exceeds its attachment budget')
      if (bytes + added > rawBudget) flush()
      ids.push(id)
      bytes += added
    }
    flush()
    if (attachments.length > 8) throw new Error('Notification exceeds the attachment budget')
  }
  const section = (title: string, content: string) => content
    ? `<h2 style="margin:28px 0 8px;font-size:16px;">${title}</h2>${content}` : ''
  const mixed = Boolean(regressions && recoveries)
  const action = leadFlag?.id ? C.evidence : C.flags
  const html = emailLayout(`<p style="margin:0 0 24px;">${escapeEmailHtml(greeting)}</p>${emailNotificationHeading(host, heading)}${mixed ? section(C.attention, regressions) + section(C.recovery, recoveries) : regressions + recoveries}${remaining ? `<p>${C.more(remaining)}</p>` : ''}${continuationFiles.map(filename => `<p>${escapeEmailHtml(C.repair.remainingAttachment(filename))}</p>`).join('')}${checked ? `<p style="font-size:13px;color:${brandLight.mutedForeground};">${escapeEmailHtml(checked)}</p>` : ''}<p style="margin:24px 0 0;"><a href="${escapeEmailHtml(href(leadFlag?.id))}" style="${emailButtonStyle}">${action}</a></p>`, { preview: heading, preferencesUrl })
  return {
    subject: C.subject(host, input.regressions.length, input.recoveries.length),
    ...emailContent(html),
    ...(attachments.length ? { attachments } : {}),
  }
}
