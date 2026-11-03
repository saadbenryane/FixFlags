import { brandLight as p } from '@/lib/design/brand-spec'
import { escapeEmailHtml as escape } from './layout'

type ChangeRow = { label?: string; text: string; href?: string }

/** Stacked rows keep the comparison readable in narrow inboxes without CSS queries. */
export function emailChangeBlock(input: {
  before?: ChangeRow;
  now: ChangeRow;
  improved?: boolean;
}) {
  const row = (value: ChangeRow, current: boolean) => {
    const dot = current ? `<span aria-hidden="true" style="display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:50%;background:${input.improved ? p.success : p.destructive};"></span>` : ''
    return `<tr><td style="padding:${current && input.before ? '0 20px 20px' : '20px'};">
${value.label ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${p.mutedForeground};">${dot}${escape(value.label)}</p>` : ''}
<p style="margin:0;font-size:16px;line-height:1.5;${current ? 'font-weight:600;' : ''}">${value.label ? '' : dot}${value.href ? `<a href="${escape(value.href)}" style="color:${p.foreground};text-decoration:underline;">${escape(value.text)}</a>` : escape(value.text)}</p>
</td></tr>`
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:12px 0 20px;background:${p.muted};border-radius:12px;">${input.before ? row(input.before, false) : ''}${row(input.now, true)}</table>`
}

export function emailNotificationHeading(website: string, heading: string) {
  return `<p style="margin:0 0 8px;font-size:14px;color:${p.mutedForeground};word-break:break-word;">${escape(website)}</p><h1 style="margin:0 0 24px;font-size:28px;line-height:1.2;letter-spacing:-0.5px;">${escape(heading)}</h1>`
}
