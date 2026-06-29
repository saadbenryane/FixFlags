interface SecretPattern {
  category: string
  pattern: RegExp
}

// Heuristic, deterministic secret patterns. False negatives are expected (this is not a
// substitute for a dedicated secret scanner) - the goal is to never let an obviously live
// credential reach our DB or an AI provider in plaintext.
export const SECRET_PATTERNS: SecretPattern[] = [
  { category: 'AWS Access Key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { category: 'GitHub Token', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { category: 'Generic Private Key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { category: 'Slack Token', pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { category: 'Stripe Key', pattern: /\b(sk|rk)_live_[A-Za-z0-9]{16,}\b/g },
  {
    category: 'Assigned secret',
    pattern: /\b((?:API|SECRET|ACCESS|PRIVATE)[A-Z0-9_]*KEY|PASSWORD|TOKEN|CLIENT_SECRET)\s*[=:]\s*['"]?[A-Za-z0-9\-_./+]{12,}['"]?/gi,
  },
]

export interface ScrubResult {
  text: string
  redactedCount: number
  categories: string[]
}

/** Replaces likely live secrets with a redaction marker. Safe to call on any text before
 *  persisting evidence or sending content to a third-party AI provider. */
export function scrubSecrets(text: string): ScrubResult {
  let result = text
  let redactedCount = 0
  const categories = new Set<string>()

  for (const { category, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0
    result = result.replace(pattern, (match) => {
      redactedCount++
      categories.add(category)
      const visible = match.slice(0, Math.min(8, Math.floor(match.length / 4)))
      return `${visible}[REDACTED]`
    })
  }

  return { text: result, redactedCount, categories: [...categories] }
}

export function containsLikelySecret(text: string): boolean {
  return SECRET_PATTERNS.some(({ pattern }) => {
    pattern.lastIndex = 0
    return pattern.test(text)
  })
}
