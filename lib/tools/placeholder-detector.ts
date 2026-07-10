import { prisma } from '@/lib/db'
import { createHash } from 'node:crypto'

export interface PlaceholderMatch {
  type: 'placeholder' | 'template-copy' | 'ai-builder' | 'template-token' | 'social-proof'
  label: string
  match: string
  context: string
}

export interface PlaceholderDetectorResult {
  url: string
  matches: PlaceholderMatch[]
  totalFound: number
  error: string | null
}

function hashInput(url: string): string {
  return createHash('sha256').update(url.toLowerCase()).digest('hex').slice(0, 16)
}

const PATTERNS: Array<{ type: PlaceholderMatch['type']; label: string; pattern: RegExp }> = [
  { type: 'placeholder', label: 'Lorem ipsum text', pattern: /lorem ipsum/i },
  { type: 'placeholder', label: 'TODO marker', pattern: /\bTODO\b/ },
  { type: 'placeholder', label: 'TBD marker', pattern: /\bTBD\b/ },
  { type: 'placeholder', label: 'Literal "undefined" in text', pattern: /\bundefined\b/ },
  { type: 'placeholder', label: '[object Object]', pattern: /\[object Object\]/ },
  { type: 'template-copy', label: '"Welcome to…" default copy', pattern: /welcome to/i },
  { type: 'template-copy', label: '"Your Company" placeholder', pattern: /your company/i },
  { type: 'template-copy', label: '"Coming soon" placeholder', pattern: /coming soon/i },
  { type: 'template-copy', label: '"Hello world" placeholder', pattern: /hello world/i },
  { type: 'ai-builder', label: 'AI-builder watermark', pattern: /\bbuilt with\s+(lovable|bolt|v0|cursor|windsurf)\b/i },
  { type: 'ai-builder', label: 'Fill-in-your-own template', pattern: /\b(add|enter)\s+your\s+(own\s+)?(content|images?|text|logo|details|information|team|data)\b/i },
  { type: 'ai-builder', label: 'In-page editor instruction', pattern: /double.?click to edit|click to edit|click here to edit/i },
  { type: 'ai-builder', label: 'Template self-identification', pattern: /\bthis\s+(is\s+a\s+)?(template|demo|example|sample)\s+(page|site|app)\b/i },
  { type: 'ai-builder', label: 'Bracket-brand placeholder', pattern: /\[your\s+(brand|company|product|name|logo|text|image|content)\]/i },
  { type: 'template-token', label: 'Unreplaced template token', pattern: /\{\{[^}]+\}\}|\$\{[^}]+\}|%[A-Z_]+%/ },
  { type: 'social-proof', label: 'Unverifiable member count', pattern: /trusted by\s+\d[\d,]*\+?\s*(teams|customers|users|companies)/i },
  { type: 'social-proof', label: 'Placeholder company name', pattern: /\[company name\]/i },
  { type: 'social-proof', label: 'Logo placeholder', pattern: /your logo here/i },
  { type: 'social-proof', label: 'Anonymous testimonial initials', pattern: /\b[A-Z][a-z]\.\s*,\s*(CEO|Founder)/ },
]

function matchContext(text: string, index: number, matchLen: number, maxCtx = 60): string {
  const start = Math.max(0, index - maxCtx)
  const end = Math.min(text.length, index + matchLen + maxCtx)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}"${text.slice(start, end).replace(/\n/g, ' ').trim()}"${suffix}`
}

export async function detectPlaceholders(url: string): Promise<PlaceholderDetectorResult> {
  const input = url.trim()
  if (!input) {
    return { url: input, matches: [], totalFound: 0, error: 'Enter a URL' }
  }

  let normalized: string
  try {
    const p = new URL(input.startsWith('http') ? input : `https://${input}`)
    normalized = p.toString()
  } catch {
    return { url: input, matches: [], totalFound: 0, error: 'Invalid URL' }
  }

  try {
    const res = await fetch(normalized, {
      headers: { 'User-Agent': 'FixFlags-PlaceholderDetector/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })

    const html = await res.text()
    const textLower = html.toLowerCase()
    const matches: PlaceholderMatch[] = []
    const seen = new Set<string>()

    for (const { type, label, pattern } of PATTERNS) {
      const allMatches = textLower.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))
      for (const m of allMatches) {
        const key = `${type}:${m[0]}`
        if (seen.has(key)) continue
        seen.add(key)
        matches.push({
          type,
          label,
          match: m[0],
          context: matchContext(html, m.index ?? 0, m[0].length),
        })
      }
    }

    // Track usage
    prisma.toolUsage.create({
      data: {
        toolSlug: 'placeholder-detector',
        inputHash: hashInput(normalized),
        result: { totalFound: matches.length, types: [...new Set(matches.map(m => m.type))] },
        source: 'TOOL_PAGE',
      },
    }).catch(() => {})

    return { url: normalized, matches, totalFound: matches.length, error: null }
  } catch (err) {
    return {
      url: normalized,
      matches: [],
      totalFound: 0,
      error: err instanceof Error && err.name === 'TimeoutError' ? 'Request timed out' : 'Could not fetch page',
    }
  }
}
