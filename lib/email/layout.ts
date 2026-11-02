import { brandLight } from '@/lib/design/brand-spec'
import { BRAND, SITE_URL } from '@/lib/marketing/copy/brand'
import { NOTIFICATION_EMAIL_COPY } from '@/lib/marketing/copy/notification-emails'

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

export const emailButtonStyle = `display:inline-block;background:${brandLight.brand};color:${brandLight.brandForeground};padding:14px 24px;border-radius:9999px;text-decoration:none;font-weight:600;`

export function formatEmailDate(date: Date, timeZone = 'UTC'): string {
  return new Intl.DateTimeFormat('en', { timeZone, month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(date)
}

export function emailLayout(content: string, options: { preview?: string; preferencesUrl?: string; preferencesLabel?: string } = {}): string {
  const p = brandLight
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${p.muted};color:${p.foreground};font-family:Arial,Helvetica,sans-serif;line-height:1.6;">
${options.preview ? `<div data-email-preview style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeEmailHtml(options.preview)}</div>` : ''}
<table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;"><tr><td style="padding:24px 16px;">
<table role="presentation" style="width:100%;background:${p.background};border-radius:20px;border-collapse:separate;"><tr><td style="padding:28px 24px;overflow-wrap:anywhere;">
<p style="margin:0 0 24px;font-size:20px;font-weight:700;"><img src="${escapeEmailHtml(SITE_URL)}/icon-192.png" alt="" width="28" height="28" style="vertical-align:middle;margin-right:8px;">${BRAND.name}</p>
${content}
${options.preferencesUrl ? `<p style="margin:32px 0 0;font-size:13px;"><a href="${escapeEmailHtml(options.preferencesUrl)}" style="color:${p.link};">${escapeEmailHtml(options.preferencesLabel ?? NOTIFICATION_EMAIL_COPY.preferences)}</a></p>` : ''}
</td></tr></table>
<p style="margin:24px 0 0;font-size:12px;color:${p.mutedForeground};">${BRAND.name}<br><a href="${escapeEmailHtml(SITE_URL)}" style="color:${p.link};">${escapeEmailHtml(SITE_URL)}</a></p>
</td></tr></table></body></html>`
}
