/**
 * Static overlay compositor. Renders semantic annotations on screenshots using sharp.
 */
import sharp from 'sharp'
import type { OverlayTemplate } from './visual-types'
export type { OverlayTemplate } from './visual-types'

export interface OverlayContext {
  screenshotBuffer: Buffer
  width: number
  height: number
  region?: { x: number; y: number; width: number; height: number }
  value?: number
  maxValue?: number
  label?: string
  detail?: string
}

export interface OverlayResult {
  buffer: Buffer
  format: 'png'
}

export async function renderOverlay(
  template: OverlayTemplate,
  ctx: OverlayContext
): Promise<OverlayResult> {
  const svgOverlays: string[] = []

  switch (template) {
    case 'gauge': svgOverlays.push(renderGaugeOverlay(ctx)); break
    case 'highlight': svgOverlays.push(renderHighlightOverlay(ctx)); break
    case 'fold-line': svgOverlays.push(renderFoldLineOverlay(ctx)); break
    case 'thumb-zone': svgOverlays.push(renderThumbZoneOverlay(ctx)); break
    case 'font-map': svgOverlays.push(renderTextOverlay(ctx, '#f59e0b', 'Typography review')); break
    case 'field-count': svgOverlays.push(renderFieldCountOverlay(ctx)); break
    case 'link-map': svgOverlays.push(renderTextOverlay(ctx, '#f59e0b', ctx.label || 'Few internal links')); break
    case 'ghost-cta': svgOverlays.push(renderGhostCtaOverlay(ctx)); break
    case 'console-panel': svgOverlays.push(renderConsolePanelOverlay(ctx)); break
    case 'timer': svgOverlays.push(renderTimerOverlay(ctx)); break
    case 'word-count': svgOverlays.push(renderWordCountOverlay(ctx)); break
    case 'size-labels': svgOverlays.push(renderTextOverlay(ctx, '#ef4444', ctx.label || 'Size issues detected')); break
  }

  if (svgOverlays.length === 0) return { buffer: ctx.screenshotBuffer, format: 'png' }

  const compositeInputs: sharp.OverlayOptions[] = svgOverlays.map((svg) => ({
    input: Buffer.from(svg),
    top: 0,
    left: 0,
  }))

  const result = await sharp(ctx.screenshotBuffer).composite(compositeInputs).png().toBuffer()
  return { buffer: result, format: 'png' }
}

function renderGaugeOverlay(ctx: OverlayContext): string {
  const value = ctx.value ?? 0
  const max = ctx.maxValue ?? 100
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const color = pct >= 90 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'
  const cx = ctx.width - 80, cy = 80, r = 50, sw = 8
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ * 0.75

  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.2)" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
      stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${circ * 0.125}"
      stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy - 5}" text-anchor="middle" fill="white" font-size="24" font-weight="bold" font-family="system-ui">${value}</text>
    <text x="${cx}" y="${cy + 15}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="12" font-family="system-ui">/ ${max}</text>
  </svg>`
}

function renderHighlightOverlay(ctx: OverlayContext): string {
  const r = ctx.region ?? { x: 0.2, y: 0.2, width: 0.6, height: 0.1 }
  const x = r.x * ctx.width, y = r.y * ctx.height, w = r.width * ctx.width, h = r.height * ctx.height
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(239,68,68,0.1)" rx="4"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="8 4" rx="4"/>
    ${ctx.label ? `<text x="${x + 8}" y="${y - 8}" fill="#ef4444" font-size="12" font-weight="bold" font-family="system-ui">${esc(ctx.label)}</text>` : ''}
    ${ctx.detail ? `<text x="${x + 8}" y="${y + h + 16}" fill="rgba(255,255,255,0.8)" font-size="11" font-family="system-ui">${esc(ctx.detail.slice(0, 80))}</text>` : ''}
  </svg>`
}

function renderFoldLineOverlay(ctx: OverlayContext): string {
  const foldY = ctx.height * 0.85
  const r = ctx.region ?? { x: 0.2, y: 0.88, width: 0.6, height: 0.07 }
  const cx = r.x * ctx.width, cy = r.y * ctx.height, cw = r.width * ctx.width, ch = r.height * ctx.height
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <line x1="0" y1="${foldY}" x2="${ctx.width}" y2="${foldY}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="12 6"/>
    <text x="${ctx.width - 8}" y="${foldY - 6}" text-anchor="end" fill="#f59e0b" font-size="11" font-weight="bold" font-family="system-ui">85% fold line</text>
    <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="rgba(239,68,68,0.15)" stroke="#ef4444" stroke-width="2" stroke-dasharray="6 3" rx="4"/>
    <text x="${cx}" y="${cy - 6}" fill="#ef4444" font-size="11" font-weight="bold" font-family="system-ui">CTA below fold</text>
  </svg>`
}

function renderThumbZoneOverlay(ctx: OverlayContext): string {
  const zt = ctx.height * 0.4, zb = ctx.height * 0.7, zh = zb - zt
  const r = ctx.region ?? { x: 0.2, y: 0.5, width: 0.6, height: 0.07 }
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${zt}" width="${ctx.width}" height="${zh}" fill="rgba(34,197,94,0.08)"/>
    <line x1="0" y1="${zt}" x2="${ctx.width}" y2="${zt}" stroke="rgba(34,197,94,0.4)" stroke-width="1" stroke-dasharray="8 4"/>
    <line x1="0" y1="${zb}" x2="${ctx.width}" y2="${zb}" stroke="rgba(34,197,94,0.4)" stroke-width="1" stroke-dasharray="8 4"/>
    <text x="${ctx.width - 4}" y="${zt + 14}" text-anchor="end" fill="rgba(34,197,94,0.6)" font-size="10" font-family="system-ui">Thumb zone</text>
    <circle cx="${ctx.width / 2}" cy="${r.y * ctx.height}" r="6" fill="#ef4444" stroke="white" stroke-width="2"/>
    <text x="${ctx.width / 2 + 12}" y="${r.y * ctx.height + 4}" fill="white" font-size="11" font-weight="bold" font-family="system-ui">CTA</text>
  </svg>`
}

function renderFieldCountOverlay(ctx: OverlayContext): string {
  const count = ctx.value ?? 0
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${ctx.width - 120}" y="8" width="112" height="36" fill="rgba(239,68,68,0.85)" rx="6"/>
    <text x="${ctx.width - 64}" y="32" text-anchor="middle" fill="white" font-size="16" font-weight="bold" font-family="system-ui">${count} fields</text>
  </svg>`
}

function renderGhostCtaOverlay(ctx: OverlayContext): string {
  const r = ctx.region ?? { x: 0.25, y: 0.45, width: 0.5, height: 0.06 }
  const x = r.x * ctx.width, y = r.y * ctx.height, w = r.width * ctx.width, h = r.height * ctx.height
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="rgba(34,197,94,0.5)" stroke-width="2" stroke-dasharray="8 4" rx="8"/>
    <text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" fill="rgba(34,197,94,0.7)" font-size="13" font-family="system-ui">Missing CTA</text>
    <line x1="${x + w / 2 - 8}" y1="${y - 12}" x2="${x + w / 2 + 8}" y2="${y - 4}" stroke="#ef4444" stroke-width="2"/>
    <line x1="${x + w / 2 + 8}" y1="${y - 12}" x2="${x + w / 2 - 8}" y2="${y - 4}" stroke="#ef4444" stroke-width="2"/>
  </svg>`
}

function renderConsolePanelOverlay(ctx: OverlayContext): string {
  const detail = ctx.detail ?? 'JavaScript errors detected'
  const lines = detail.split('\n').slice(0, 3)
  const ph = 60 + lines.length * 16
  const py = ctx.height - ph - 8
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="${py}" width="${ctx.width - 16}" height="${ph}" fill="rgba(30,30,30,0.9)" rx="6"/>
    <text x="16" y="${py + 18}" fill="#ef4444" font-size="11" font-weight="bold" font-family="monospace">Console Errors</text>
    ${lines.map((l, i) => `<text x="16" y="${py + 34 + i * 16}" fill="rgba(255,255,255,0.7)" font-size="10" font-family="monospace">${esc(l.slice(0, 80))}</text>`).join('\n')}
  </svg>`
}

function renderTimerOverlay(ctx: OverlayContext): string {
  const sec = ctx.value ? (ctx.value / 1000).toFixed(1) : '?'
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${ctx.width - 90}" y="8" width="82" height="32" fill="rgba(239,68,68,0.85)" rx="6"/>
    <text x="${ctx.width - 49}" y="30" text-anchor="middle" fill="white" font-size="15" font-weight="bold" font-family="monospace">${sec}s</text>
  </svg>`
}

function renderWordCountOverlay(ctx: OverlayContext): string {
  const count = ctx.value ?? 0
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${ctx.width - 90}" y="8" width="82" height="28" fill="rgba(245,158,11,0.85)" rx="4"/>
    <text x="${ctx.width - 49}" y="26" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="system-ui">~${count} words</text>
  </svg>`
}

function renderTextOverlay(ctx: OverlayContext, color: string, text: string): string {
  return `<svg width="${ctx.width}" height="${ctx.height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="220" height="28" fill="rgba(0,0,0,0.7)" rx="4"/>
    <text x="16" y="26" fill="${color}" font-size="12" font-weight="bold" font-family="system-ui">${esc(text)}</text>
  </svg>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
