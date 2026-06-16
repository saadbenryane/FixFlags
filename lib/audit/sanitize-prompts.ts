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

type SanitizableFlag = {
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

export function sanitizeFlagFields<T extends SanitizableFlag>(flag: T): T {
  const fallback = flag.fix || flag.evidence || 'Apply the fix described in the evidence.'
  const evidence = flag.evidence ?? fallback

  const sanitize = (value: string | null | undefined) =>
    value ? sanitizePromptText(value, fallback) : value

  const defaultVerification = `Confirm the issue described in evidence is resolved: ${evidence.slice(0, 120)}`

  return {
    ...flag,
    problem: flag.problem
      ? sanitizePromptText(
          flag.problem,
          'An issue was detected that should be addressed before launch.'
        )
      : flag.problem,
    evidence: flag.evidence
      ? sanitizePromptText(flag.evidence, fallback)
      : flag.evidence,
    whyItMatters: flag.whyItMatters
      ? sanitizePromptText(
          flag.whyItMatters,
          'This issue affects user experience and should be fixed before launch.'
        )
      : flag.whyItMatters,
    fix: sanitize(flag.fix) ?? flag.fix,
    agentPrompt: sanitize(flag.agentPrompt),
    cursorPrompt: sanitize(flag.cursorPrompt),
    claudePrompt: sanitize(flag.claudePrompt),
    lovablePrompt: sanitize(flag.lovablePrompt),
    boltPrompt: sanitize(flag.boltPrompt),
    verificationRule: flag.verificationRule
      ? sanitizePromptText(flag.verificationRule, defaultVerification)
      : defaultVerification,
  }
}

type SanitizableRubric = {
  rubricPrompt?: string
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  summary: string
}

function sanitizeRubricPrompts<T extends SanitizableRubric>(rubric: T): T {
  const fallback = rubric.summary
  const sanitize = (value: string | null | undefined) =>
    value ? sanitizePromptText(value, rubric.rubricPrompt ?? fallback) : value

  return {
    ...rubric,
    rubricPrompt: sanitizePromptText(rubric.rubricPrompt ?? fallback, fallback),
    cursorPrompt: sanitize(rubric.cursorPrompt),
    claudePrompt: sanitize(rubric.claudePrompt),
    lovablePrompt: sanitize(rubric.lovablePrompt),
    boltPrompt: sanitize(rubric.boltPrompt),
  }
}

export function sanitizeJudgeOutput<
  T extends {
    newFlags: SanitizableFlag[]
    enrichments: Array<SanitizableFlag & { checkId?: string; whyItMatters: string }>
    rubrics: Array<SanitizableRubric>
  },
>(output: T): T {
  const dedupedEnrichments: typeof output.enrichments = []
  const seenCheckIds = new Set<string>()
  for (const enrichment of output.enrichments) {
    const checkId = enrichment.checkId
    if (!checkId || seenCheckIds.has(checkId)) continue
    seenCheckIds.add(checkId)
    dedupedEnrichments.push(enrichment)
  }

  return {
    ...output,
    newFlags: output.newFlags.map((f) => sanitizeFlagFields(f)),
    enrichments: dedupedEnrichments.map((e) =>
      sanitizeFlagFields({
        ...e,
        fix: e.whyItMatters,
        evidence: e.checkId ?? e.whyItMatters,
      })
    ),
    rubrics: output.rubrics.map((rubric) => sanitizeRubricPrompts(rubric)),
  }
}

/** Re-sanitize persisted flag fields before API/MCP responses. */
export function sanitizeFlagForRead<
  T extends SanitizableFlag & { fix: string; evidence: string },
>(flag: T): T {
  return sanitizeFlagFields(flag)
}

/** Re-sanitize persisted rubric prompts before API/MCP responses. */
export function sanitizeRubricForRead<T extends SanitizableRubric>(rubric: T): T {
  return sanitizeRubricPrompts(rubric)
}
