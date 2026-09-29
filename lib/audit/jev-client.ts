import { getEnv } from '@/lib/env'

export interface JevQuestionChoice {
  type: 'choice'
  instructions: string
  criteria: Record<string, string>
}

export interface JevQuestionScore {
  type: 'score'
  instructions: string
  criteria: string[]
}

export interface JevQuestionNoul {
  type: 'noul'
  instructions: string
}

export type JevQuestion = JevQuestionChoice | JevQuestionScore | JevQuestionNoul

export interface JevAnswerChoice {
  type: 'choice'
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

export interface JevAnswerScore {
  type: 'score'
  score: number
  confidence: number
  probabilities: Record<string, number>
  legend: Record<string, string>
}

export interface JevAnswerNoul {
  type: 'noul'
  noul: number
}

export type JevAnswer = JevAnswerChoice | JevAnswerScore | JevAnswerNoul

export interface JevResponse {
  model: string
  answers: Record<string, JevAnswer>
  usage: {
    input_tokens: number
    cost_usd: number
    credits_remaining_usd: number
  }
}

export interface JevRequest {
  model?: string
  state: string | Record<string, unknown> | unknown[]
  questions: Record<string, JevQuestion>
}

function getJevApiKey(): string | null {
  return getEnv().TYPESAFE_API_KEY ?? process.env.TYPESAFE_API_KEY ?? null
}

function getJevModel(): string {
  return process.env.JEV_MODEL ?? 'jev-1.13.0'
}

function getJevBaseUrl(): string {
  return process.env.JEV_BASE_URL ?? 'https://api.typesafe.ai/v1/systemone'
}

export async function callJev(request: JevRequest): Promise<JevResponse> {
  const apiKey = getJevApiKey()
  if (!apiKey) {
    throw new Error('TYPESAFE_API_KEY not configured')
  }

  const body = JSON.stringify({
    model: request.model ?? getJevModel(),
    state: request.state,
    questions: request.questions,
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch(getJevBaseUrl(), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body,
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`JEV API error ${response.status}: ${text}`)
    }

    const data = await response.json() as JevResponse
    return data
  } finally {
    clearTimeout(timeout)
  }
}

export function isJevConfigured(): boolean {
  return getJevApiKey() !== null
}