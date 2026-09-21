/** One internal boundary for bounded semantic decisions. Runtime code owns policy and actions. */
export const DECISION_MODEL = 'jev-1.13.0' as const

export type DecisionQuestion =
  | { kind: 'choose'; prompt: string; options: Record<string, string> }
  | { kind: 'answer'; prompt: string }
  | { kind: 'score'; prompt: string; levels: string[] }

export type DecisionAnswer =
  | { kind: 'choose'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { kind: 'answer'; probability: number }
  | { kind: 'score'; value: number; probabilities: Record<string, number>; confidence: number }

export interface DecisionReceipt {
  model: string
  answers: Record<string, DecisionAnswer>
  inputTokens: number | null
}

export class DecisionUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecisionUnavailable'
  }
}

function unit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

function distribution(value: unknown, keys: string[]): value is Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entries = Object.entries(value)
  return (
    entries.length === keys.length &&
    entries.every(([key, probability]) => keys.includes(key) && unit(probability)) &&
    Math.abs(entries.reduce((sum, [, probability]) => sum + (probability as number), 0) - 1) < 0.02
  )
}

function parseAnswer(value: unknown, question: DecisionQuestion): DecisionAnswer {
  if (!value || typeof value !== 'object') throw new DecisionUnavailable('Invalid decision answer')
  const answer = value as Record<string, unknown>
  if (question.kind === 'answer') {
    if (answer.type !== 'noul' || !unit(answer.noul))
      throw new DecisionUnavailable('Invalid yes or no answer')
    return { kind: 'answer', probability: answer.noul }
  }
  if (question.kind === 'choose') {
    const keys = Object.keys(question.options)
    if (
      answer.type !== 'choice' ||
      typeof answer.choice !== 'string' ||
      !keys.includes(answer.choice) ||
      !distribution(answer.probabilities, keys) ||
      !unit(answer.confidence)
    ) throw new DecisionUnavailable('Invalid choice answer')
    const probabilities = answer.probabilities as Record<string, number>
    if (probabilities[answer.choice]! < Math.max(...Object.values(probabilities)) - 0.000001)
      throw new DecisionUnavailable('Decision choice disagrees with distribution')
    return { kind: 'choose', choice: answer.choice, probabilities, confidence: answer.confidence }
  }
  const keys = question.levels.map((_, index) => String(index))
  if (
    answer.type !== 'score' ||
    typeof answer.score !== 'number' ||
    !Number.isFinite(answer.score) ||
    answer.score < 0 ||
    answer.score > question.levels.length - 1 ||
    !distribution(answer.probabilities, keys) ||
    !unit(answer.confidence)
  ) throw new DecisionUnavailable('Invalid score answer')
  return {
    kind: 'score',
    value: answer.score,
    probabilities: answer.probabilities as Record<string, number>,
    confidence: answer.confidence,
  }
}

/** Questions share one state and are evaluated in parallel by TypeSafe. */
export async function decide(
  state: { trusted: Record<string, unknown>; observed: Record<string, unknown> },
  questions: Record<string, DecisionQuestion>,
  options: { fetcher?: typeof fetch; apiKey?: string } = {},
): Promise<DecisionReceipt> {
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY
  if (!apiKey) throw new DecisionUnavailable('TypeSafe decision service is not configured')
  const entries = Object.entries(questions)
  if (entries.length === 0 || entries.length > 12) throw new DecisionUnavailable('Invalid question count')
  const wireQuestions: Record<string, unknown> = {}
  for (const [id, question] of entries) {
    if (!/^[a-z][a-z0-9_]*$/.test(id) || !question.prompt.trim())
      throw new DecisionUnavailable('Invalid decision question')
    if (question.kind === 'choose') {
      const keys = Object.keys(question.options)
      if (keys.length < 2 || keys.length > 64 || keys.some((key) => !/^[a-z][a-z0-9_]*$/.test(key)))
        throw new DecisionUnavailable('Invalid choice options')
      wireQuestions[id] = { type: 'choice', instructions: question.prompt, criteria: question.options }
    } else if (question.kind === 'answer') {
      wireQuestions[id] = { type: 'noul', instructions: question.prompt }
    } else {
      if (question.levels.length < 2 || question.levels.length > 10)
        throw new DecisionUnavailable('Invalid score levels')
      wireQuestions[id] = { type: 'score', instructions: question.prompt, criteria: question.levels }
    }
  }
  const body = JSON.stringify({ model: DECISION_MODEL, state, questions: wireQuestions })
  if (body.length > 24_000) throw new DecisionUnavailable('Decision state is too large')
  let response: Response
  try {
    response = await (options.fetcher ?? fetch)('https://api.typesafe.ai/v1/systemone', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(12_000),
    })
  } catch {
    throw new DecisionUnavailable('Decision service did not respond')
  }
  if (!response.ok) throw new DecisionUnavailable(`Decision service returned ${response.status}`)
  let payload: unknown
  try { payload = await response.json() } catch { throw new DecisionUnavailable('Invalid decision response') }
  if (!payload || typeof payload !== 'object') throw new DecisionUnavailable('Invalid decision response')
  const result = payload as Record<string, unknown>
  if (result.model !== DECISION_MODEL || !result.answers || typeof result.answers !== 'object')
    throw new DecisionUnavailable('Unexpected decision model or answer set')
  const rawAnswers = result.answers as Record<string, unknown>
  const answers: Record<string, DecisionAnswer> = {}
  for (const [id, question] of entries) answers[id] = parseAnswer(rawAnswers[id], question)
  const usage = result.usage as Record<string, unknown> | undefined
  return {
    model: result.model,
    answers,
    inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : null,
  }
}
