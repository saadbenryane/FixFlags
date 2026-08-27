import { verificationRuleForCheckId } from '@/lib/audit/verification-rules'
import type { RankableFlag } from '@/lib/audit/flag-types'
import {
  baseCheckId,
  isPageScopeCheck,
  parseEvidenceTargets,
  type EvidenceTarget,
} from '@/lib/audit/evidence-targets'
import { DESKTOP_VIEWPORT, MOBILE_VIEWPORT } from '@/lib/audit/viewports'
import { devicesForCheck } from '@/lib/marketing/evidence-selectors'
import { visualTargetLabel } from '@/lib/marketing/evidence-regions'

export const EDITOR_FINDING_LEAD =
  'This is a FixFlags finding from the live page, not a guess about your repo.'

export const EDITOR_PLAN_ALL_LEAD =
  'Plan all of these changes before implementing any of them. Then implement only that plan.'

/** Aggregate copy lead. Finding first, then plan-all. */
export const AGENT_COPY_LEAD = `${EDITOR_FINDING_LEAD}\n\n${EDITOR_PLAN_ALL_LEAD}`

const LEGACY_LOCKED = new Set([
  'Sign up',
  'Create a free account to see evidence and fix prompts.',
  'Sign up to see why this matters and get a fix prompt for your editor.',
  'Sign up to get the fix prompt.',
  'Sign up to see verification steps.',
])

export interface EditorHandoffContext {
  url?: string | null
  pageType?: string | null
  pageUrls?: string[]
}

export interface EditorLocation {
  pageUrl: string | null
  pageKind: string | null
  viewport: string | null
  section: string | null
  currentText: string | null
  extraPageUrls: string[]
  documentHead: boolean
}

export function locateFlagForEditor(
  flag: RankableFlag,
  context: EditorHandoffContext = {}
): EditorLocation {
  const checkId = baseCheckId(flag.checkId)
  const targets = parseEvidenceTargets(flag.evidenceTargets)
  const documentHead = Boolean(checkId) && isPageScopeCheck(checkId)
  const pageUrl = firstUrl(flag.pageUrl) ?? firstUrl(context.url)
  const extraPageUrls = uniqueUrls([
    ...(context.pageUrls ?? []),
    ...(flag.pageUrl ? [flag.pageUrl] : []),
  ]).filter((url) => url !== pageUrl)

  return {
    pageUrl,
    pageKind: context.pageType?.trim() || null,
    viewport: viewportForFlag(flag),
    section: sectionForFlag(flag, targets, documentHead),
    currentText: documentHead ? null : currentTextForFlag(flag, targets),
    extraPageUrls,
    documentHead,
  }
}

export function stripInventedFilePaths(text: string): string {
  let out = text.replace(/\r\n/g, '\n')
  out = out.replace(/^--- [^\n]+\n\+\+\+ [^\n]+\n/gm, '')
  out = out.replace(/^@@ .+@@.*\n/gm, '')
  out = out.replace(/@[\w./-]+\.(?:tsx?|jsx?|vue|html|css)\b/gi, '')
  out = out.replace(
    /\s+(?:in|at|from)\s+[`']?(?:app|src|pages|components|lib|public)\/[\w./-]+(?:\.(?:tsx?|jsx?|vue|html|css))?[`']?/gi,
    ''
  )
  out = out.replace(
    /(?:^|\n)\s*[`']?(?:app|src|pages|components|lib|public)\/[\w./-]+\.(?:tsx?|jsx?|vue|html|css)[`']?\s*:?\s*/gi,
    '\n'
  )
  out = out.replace(/[ \t]{2,}/g, ' ')
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

export function taskBodyForFlag(flag: RankableFlag): string {
  const raw = resolvedTask(flag) ?? flag.problem
  return stripInventedFilePaths(normalizeTaskBody(raw))
}

export function buildEditorHandoffPrompt(
  flag: RankableFlag,
  context: EditorHandoffContext = {}
): string {
  if (!resolvedTask(flag)) return ''
  const location = locateFlagForEditor(flag, context)
  const task = taskBodyForFlag(flag)
  const verify = verificationFor(flag)
  const lines: string[] = [EDITOR_FINDING_LEAD, '']
  lines.push(...groundLines(location))
  if (lines[lines.length - 1] !== '') lines.push('')
  if (task.includes('\n')) {
    lines.push('Task:', task)
  } else {
    lines.push(`Task: ${task}`)
  }
  lines.push('', 'How to work:')
  lines.push(`1. ${searchStep(flag, location)}`)
  lines.push(
    '2. Make a short plan: which file you will change, what you will change, what you will not touch.'
  )
  lines.push('3. Implement only that plan.')
  lines.push(
    '',
    'Stay within the listed items. Do not invent pricing or signup pages, or expand scope beyond these Flags.'
  )
  lines.push(
    '',
    'Do not invent file paths. Do not change unrelated sections.' + viewportGuard(location)
  )
  if (verify) {
    lines.push('', `Verify: ${verify}`)
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function formatPlanItem(
  flag: RankableFlag,
  index: number,
  context: EditorHandoffContext,
  confidence: string
): string {
  const location = locateFlagForEditor(flag, context)
  const rubric = flag.rubric.charAt(0).toUpperCase() + flag.rubric.slice(1).toLowerCase()
  const tag = `[${flag.severity} · ${rubric} · ${confidence}]`
  const block = [`${index}. ${tag} ${flag.problem}`]
  for (const line of itemGroundLines(location)) {
    block.push(`   ${line}`)
  }
  const task = taskBodyForFlag(flag).replace(/\n/g, '\n   ')
  block.push(`   Task: ${task}`)
  const verify = verificationFor(flag)
  if (verify) block.push(`   Verify: ${verify}`)
  return block.join('\n')
}

export function buildPlanBundleHeader(context: EditorHandoffContext): string {
  const lines = [EDITOR_FINDING_LEAD, '']
  const page = pageLineFor(firstUrl(context.url), context.pageType?.trim() || null)
  if (page) lines.push(page, '')
  lines.push(EDITOR_PLAN_ALL_LEAD, '')
  lines.push('How to work:')
  lines.push('1. Search the repo for the current text or element named in each item.')
  lines.push(
    '2. Make one short plan covering every item: which files, what changes, what you will not touch.'
  )
  lines.push(
    '3. Implement only that plan. Do not invent file paths. Do not change unrelated sections.'
  )
  lines.push(
    '4. Stay within the listed items. Do not invent pricing or signup pages, or expand scope beyond these Flags.'
  )
  lines.push('')
  return lines.join('\n')
}

function resolvedTask(flag: RankableFlag): string | null {
  const candidates = [
    flag.agentPrompt,
    flag.cursorPrompt,
    flag.claudePrompt,
    flag.windsurfPrompt,
    flag.lovablePrompt,
    flag.boltPrompt,
    flag.fix,
  ]
  for (const candidate of candidates) {
    const trimmed = candidate?.trim()
    if (!trimmed) continue
    if (LEGACY_LOCKED.has(trimmed)) continue
    return trimmed
  }
  return null
}

function verificationFor(flag: RankableFlag): string | null {
  if (flag.verificationRule?.trim()) return flag.verificationRule.trim()
  if (flag.checkId) return verificationRuleForCheckId(flag.checkId)
  return null
}

function normalizeTaskBody(raw: string): string {
  const trimmed = raw.trim()
  const expected = trimmed.match(
    /## Expected behavior\s*\n+([\s\S]*?)(?=\n## |\s*$)/i
  )
  if (expected?.[1]?.trim()) return expected[1].trim()

  if (/^## Goal\b/im.test(trimmed)) {
    const withoutVerify = trimmed
      .replace(/\n## How to verify\s*\n[\s\S]*$/i, '')
      .trim()
    const withoutHeaders = withoutVerify
      .replace(/^## Goal\s*\n+/im, '')
      .replace(/\n## Observed behavior\s*\n+/gi, '\n')
      .replace(/\n## Expected behavior\s*\n+/gi, '\n')
      .trim()
    if (withoutHeaders) return withoutHeaders
  }

  return trimmed
}

function groundLines(location: EditorLocation): string[] {
  const lines: string[] = []
  const page = pageLineFor(location.pageUrl, location.pageKind)
  if (page) lines.push(page)
  if (location.viewport) lines.push(`Viewport: ${location.viewport}`)
  if (location.section) lines.push(`Section: ${location.section}`)
  if (location.currentText) lines.push(`Current: ${location.currentText}`)
  if (location.extraPageUrls.length > 0) {
    lines.push(`Also observed on: ${location.extraPageUrls.join(', ')}`)
  }
  return lines
}

function itemGroundLines(location: EditorLocation): string[] {
  const lines: string[] = []
  if (location.pageUrl) lines.push(`Page: ${location.pageUrl}`)
  if (location.viewport) lines.push(`Viewport: ${location.viewport}`)
  if (location.section) lines.push(`Section: ${location.section}`)
  if (location.currentText) lines.push(`Current: ${location.currentText}`)
  return lines
}

function pageLineFor(url: string | null, pageKind: string | null): string | null {
  if (!url && !pageKind) return null
  if (url && pageKind) return `Page: ${url} (${pageKind})`
  if (url) return `Page: ${url}`
  return `Page: ${pageKind}`
}

function viewportForFlag(flag: RankableFlag): string | null {
  const checkId = baseCheckId(flag.checkId)
  if (!checkId) return null
  const devices = devicesForCheck(checkId)
  if (devices.length !== 1) return null
  if (devices[0] === 'mobile') {
    return `mobile ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`
  }
  return `desktop ${DESKTOP_VIEWPORT.width}x${DESKTOP_VIEWPORT.height}`
}

function sectionForFlag(
  flag: RankableFlag,
  targets: EvidenceTarget[],
  documentHead: boolean
): string | null {
  if (documentHead) return 'document head'
  const measured = targets.find((target) => target.kind === 'element' && target.label.trim())
  if (
    measured &&
    measured.label !== 'Flagged element' &&
    measured.label !== 'Flagged area' &&
    measured.label !== 'Flagged area on this page'
  ) {
    return measured.label
  }
  const checkId = baseCheckId(flag.checkId)
  if (!checkId) return null
  const visual = visualTargetLabel(checkId)
  if (!visual || visual === 'Flagged area on this page') return null
  return visual
}

function currentTextForFlag(flag: RankableFlag, targets: EvidenceTarget[]): string | null {
  const quoted = quotedSearchKey(flag, targets)
  const checkId = baseCheckId(flag.checkId)
  if (!quoted) return null
  if (/^h1-/.test(checkId) || /headline|H1/i.test(visualTargetLabel(checkId))) {
    return `the H1 reads "${quoted}"`
  }
  if (/cta|button/i.test(checkId) || /call-to-action/i.test(visualTargetLabel(checkId))) {
    return `the primary CTA reads "${quoted}"`
  }
  return `"${quoted}"`
}

function quotedSearchKey(flag: RankableFlag, targets: EvidenceTarget[]): string | null {
  const nodeText = targets
    .map((target) => target.text?.trim())
    .find((text): text is string => Boolean(text && text.length >= 2))
  return nodeText ?? extractQuotedText(flag.evidence ?? '')
}

function measuredSelector(targets: EvidenceTarget[]): string | null {
  const selector = targets.find(
    (target) => target.kind === 'element' && target.selector?.trim()
  )?.selector?.trim()
  return selector || null
}

function extractQuotedText(evidence: string): string | null {
  const match = evidence.match(/[“"']([^”"']{2,160})[”"']/)
  const value = match?.[1]?.trim()
  if (!value || value.length < 2) return null
  return value
}

function searchStep(flag: RankableFlag, location: EditorLocation): string {
  if (location.documentHead) {
    return 'Search the repo for the page metadata in the document head (title, description, Open Graph, robots, canonical).'
  }
  const targets = parseEvidenceTargets(flag.evidenceTargets)
  const quoted = quotedSearchKey(flag, targets)
  const selector = measuredSelector(targets)
  if (quoted && selector) {
    return `Search the repo for the exact text "${quoted}" (selector ${selector}).`
  }
  if (quoted) return `Search the repo for the exact text "${quoted}".`
  if (location.viewport?.startsWith('mobile')) {
    return `Search the repo for the current ${location.section ?? 'element'} and the layout that renders on mobile.`
  }
  return `Search the repo for the code that renders this ${location.section ?? 'page observation'}.`
}

function viewportGuard(location: EditorLocation): string {
  if (location.viewport?.startsWith('mobile')) {
    return ' Do not restyle desktop unless this mobile fix requires it.'
  }
  if (location.viewport?.startsWith('desktop')) {
    return ' Do not restyle mobile unless this desktop fix requires it.'
  }
  return ''
}

function firstUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function uniqueUrls(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const url = firstUrl(value)
    if (!url || seen.has(url)) continue
    seen.add(url)
    out.push(url)
  }
  return out
}
