const SPECULATION_PATTERNS = [
  /\blikely\b/i,
  /\bprobably\b/i,
  /\bmay be in\b/i,
  /\bestimated CTR\b/i,
  /\bCTR loss\b/i,
  /\bCTR ~\d+/i,
  /\bCTR (improved|increased|dropped)\b/i,
  /\bclick-through rate\b/i,
  /\b\d+-\d+% (CTR|conversion|drop)/i,
  /\bconvert(s|ion)? \d+-\d+%/i,
  /\b(increased?|improved?|dropped?) \d+%/i,
  /\bconversion (rate )?(increased?|improved?) \d+%/i,
  /\bLighthouse score ~\d+/i,
  /\bscore ~\d+/i,
  /\bform submissions by \d+%/i,
  /\bbounce rate (dropped|increased|improved?) \d+%/i,
  /\b(increases?|reduces?) bounce rate\b/i,
  /\b\d+% of traffic\b/i,
  /\bup to \d+%/i,
  /\b\d+% less engagement\b/i,
  /\b\d+x more engagement\b/i,
  /\btime-on-page by \d+%/i,
  /\bCSS size reduced by \d+%/i,
  /\bA\/B test\b/i,
  /\b\+?\d+ pts on re-check\b/i,
]

const UNSUPPORTED_FILE_GUESS =
  /\b(likely|probably|may be in)\b.*\b(_app\.tsx|layout\.tsx)\b/i

const COMPONENT_GUESS =
  /\bIn the (footer|hero|nav|mobile nav|article|layout|entry script|HTML head|showcase carousel|Vector skin|article header|article template|code block wrapper|article layout|hero section|footer component|hero component) (component|template|stylesheet|navigation|section|CSS|script|wrapper)\b/i

export function containsSpeculation(text: string): boolean {
  return (
    SPECULATION_PATTERNS.some((pattern) => pattern.test(text)) ||
    UNSUPPORTED_FILE_GUESS.test(text) ||
    COMPONENT_GUESS.test(text)
  )
}

export function sanitizePromptText(text: string, fallback: string): string {
  if (!text || containsSpeculation(text)) {
    return fallback
  }
  return text
}

type SanitizableFinding = {
  problem?: string
  evidence?: string
  whyItMatters?: string
  fix?: string
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  verificationRule?: string | null
}

export function sanitizeFindingFields<T extends SanitizableFinding>(finding: T): T {
  const fallback =
    finding.fix || finding.evidence || 'Apply the fix described in the evidence.'
  const evidence = finding.evidence ?? fallback

  const sanitize = (value: string | null | undefined) =>
    value ? sanitizePromptText(value, fallback) : value

  const defaultVerification = `Confirm the issue described in evidence is resolved: ${evidence.slice(0, 120)}`

  return {
    ...finding,
    problem: finding.problem
      ? sanitizePromptText(
          finding.problem,
          'An issue was detected that should be addressed before launch.'
        )
      : finding.problem,
    evidence: finding.evidence
      ? sanitizePromptText(finding.evidence, fallback)
      : finding.evidence,
    whyItMatters: finding.whyItMatters
      ? sanitizePromptText(
          finding.whyItMatters,
          'This issue affects user experience and should be fixed before launch.'
        )
      : finding.whyItMatters,
    fix: sanitize(finding.fix) ?? finding.fix,
    agentPrompt: sanitize(finding.agentPrompt),
    cursorPrompt: sanitize(finding.cursorPrompt),
    claudePrompt: sanitize(finding.claudePrompt),
    lovablePrompt: sanitize(finding.lovablePrompt),
    boltPrompt: sanitize(finding.boltPrompt),
    verificationRule: finding.verificationRule
      ? sanitizePromptText(finding.verificationRule, defaultVerification)
      : defaultVerification,
  }
}

type SanitizableArea = {
  areaPrompt?: string
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  summary: string
}

function sanitizeAreaPrompts<T extends SanitizableArea>(area: T): T {
  const fallback = area.summary
  const sanitize = (value: string | null | undefined) =>
    value ? sanitizePromptText(value, area.areaPrompt ?? fallback) : value

  return {
    ...area,
    areaPrompt: sanitizePromptText(area.areaPrompt ?? fallback, fallback),
    cursorPrompt: sanitize(area.cursorPrompt),
    claudePrompt: sanitize(area.claudePrompt),
    lovablePrompt: sanitize(area.lovablePrompt),
    boltPrompt: sanitize(area.boltPrompt),
  }
}

export function sanitizeJudgeOutput<
  T extends {
    newFindings: SanitizableFinding[]
    enrichments: Array<SanitizableFinding & { checkId?: string; whyItMatters: string }>
    areas: Array<SanitizableArea>
  },
>(output: T): T {
  return {
    ...output,
    newFindings: output.newFindings.map((f) => sanitizeFindingFields(f)),
    enrichments: output.enrichments.map((e) =>
      sanitizeFindingFields({
        ...e,
        fix: e.whyItMatters,
        evidence: e.checkId ?? e.whyItMatters,
      })
    ),
    areas: output.areas.map((area) => sanitizeAreaPrompts(area)),
  }
}

/** Re-sanitize persisted finding fields before API/MCP responses. */
export function sanitizeFindingForRead<
  T extends SanitizableFinding & { fix: string; evidence: string },
>(finding: T): T {
  return sanitizeFindingFields(finding)
}

/** Re-sanitize persisted area prompts before API/MCP responses. */
export function sanitizeAreaForRead<T extends SanitizableArea>(area: T): T {
  return sanitizeAreaPrompts(area)
}
