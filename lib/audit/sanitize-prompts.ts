const SPECULATION_PATTERNS = [
  /\blikely\b/i,
  /\bprobably\b/i,
  /\bmay be in\b/i,
  /\bestimated CTR\b/i,
  /\bCTR loss\b/i,
  /\bCTR ~\d+/i,
  /\bCTR (improved|increased|dropped)\b/i,
  /\b\d+-\d+% (CTR|conversion|drop)/i,
  /\bconvert(s|ion)? \d+-\d+%/i,
  /\b(increased?|improved?|dropped?) \d+%/i,
  /\bconversion (rate )?(increased?|improved?) \d+%/i,
  /\bLighthouse score ~\d+/i,
  /\bscore ~\d+/i,
  /\bform submissions by \d+%/i,
  /\bbounce rate dropped \d+%/i,
]

const UNSUPPORTED_FILE_GUESS = /\b(likely|probably|may be in)\b.*\b(_app\.tsx|layout\.tsx)\b/i

export function containsSpeculation(text: string): boolean {
  return SPECULATION_PATTERNS.some((pattern) => pattern.test(text))
}

export function sanitizePromptText(text: string, fallback: string): string {
  if (!text || containsSpeculation(text) || UNSUPPORTED_FILE_GUESS.test(text)) {
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
    verificationRule:
      finding.verificationRule ??
      `Confirm the issue described in evidence is resolved: ${evidence.slice(0, 120)}`,
  }
}

export function sanitizeJudgeOutput<
  T extends {
    newFindings: SanitizableFinding[]
    enrichments: Array<SanitizableFinding & { checkId?: string; whyItMatters: string }>
    areas: Array<{ areaPrompt?: string; cursorPrompt?: string | null; summary: string }>
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
    areas: output.areas.map((area) => {
      const fallback = area.summary
      return {
        ...area,
        areaPrompt: sanitizePromptText(area.areaPrompt ?? fallback, fallback),
        cursorPrompt: area.cursorPrompt
          ? sanitizePromptText(area.cursorPrompt, area.areaPrompt ?? fallback)
          : area.cursorPrompt,
      }
    }),
  }
}
