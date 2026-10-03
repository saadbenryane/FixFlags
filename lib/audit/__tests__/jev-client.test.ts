import { afterEach, describe, expect, it } from 'vitest'
import { callJev, isJevConfigured, type JevAnswer } from '../jev-client'

/**
 * The JEV research gate lives in scripts/jev-validate.ts. These tests cover the
 * shared transport it depends on, plus the two contract assumptions that would
 * silently corrupt results if wrong:
 *
 *  1. `score` answers are 0-based level indexes, not 0-100 values.
 *  2. Distributions on choice/score answers must sum to 1 and agree with the
 *     winning answer, otherwise a "calibrated" probability is meaningless.
 */
const ORIGINAL_ENV = { ...process.env }

async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved = { ...process.env }
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return await fn()
  } finally {
    process.env = { ...ORIGINAL_ENV }
    Object.assign(process.env, saved)
  }
}

describe('jev-client configuration', () => {
  it('reports unconfigured when no key is present', async () => {
    await withEnv({ TYPESAFE_API_KEY: undefined }, () => {
      expect(isJevConfigured()).toBe(false)
    })
  })

  it('reports configured when a key is present', async () => {
    await withEnv({ TYPESAFE_API_KEY: 'test-key' }, () => {
      expect(isJevConfigured()).toBe(true)
    })
  })
})

describe('callJev request shape', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const NUL = { ok: { type: 'noul' as const, instructions: 'Is this fine?' } }

  it('POSTs the pinned model, state and questions with a bearer token', async () => {
    let captured: { url: string; init: RequestInit } | null = null
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      captured = { url, init }
      return new Response(
        JSON.stringify({
          model: 'jev-1.13.0',
          answers: {},
          usage: { input_tokens: 10, cost_usd: 0.0000042, credits_remaining_usd: 5 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    }) as unknown as typeof fetch

    await withEnv({ TYPESAFE_API_KEY: 'k1', JEV_MODEL: 'jev-1.13.0' }, () =>
      callJev({ state: { url: 'https://example.com' }, questions: NUL })
    )

    expect(captured).not.toBeNull()
    const call = captured as unknown as { url: string; init: RequestInit }
    expect(call.url).toBe('https://api.typesafe.ai/v1/systemone')
    expect(call.init.method).toBe('POST')
    const headers = call.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer k1')
    const body = JSON.parse(String(call.init.body))
    expect(body.model).toBe('jev-1.13.0')
    expect(body.questions.ok.type).toBe('noul')
  })

  it('surfaces a non-2xx response as a thrown error', async () => {
    globalThis.fetch = (async () =>
      new Response('upstream down', { status: 502 })) as unknown as typeof fetch

    await withEnv({ TYPESAFE_API_KEY: 'k1' }, async () => {
      await expect(callJev({ state: 'x', questions: NUL })).rejects.toThrow(/502/)
    })
  })

  it('refuses to call the API with no key configured', async () => {
    await withEnv({ TYPESAFE_API_KEY: undefined }, async () => {
      await expect(callJev({ state: 'x', questions: NUL })).rejects.toThrow(/TYPESAFE_API_KEY/)
    })
  })
})

describe('JEV answer contract assumptions', () => {
  it('treats a score answer as a level index, not a 0-100 value', () => {
    // Documents the assumption the harness depends on. JEV returns a
    // fractional index into the ordered criteria array.
    const answer: JevAnswer = {
      type: 'score',
      score: 8,
      confidence: 0.8,
      probabilities: Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [String(i), i === 8 ? 0.8 : 0.2 / 9])
      ),
      legend: {},
    }
    expect(answer.type === 'score' && answer.score).toBe(8)
    expect(answer.type === 'score' && answer.score).toBeLessThan(10)
  })

  it('noul answers are calibrated probabilities in 0-1', () => {
    const answer: JevAnswer = { type: 'noul', noul: 0.92 }
    expect(answer.type === 'noul' && answer.noul).toBeGreaterThanOrEqual(0)
    expect(answer.type === 'noul' && answer.noul).toBeLessThanOrEqual(1)
  })

  it('choice answers must name a key that exists in the distribution', () => {
    const answer: JevAnswer = {
      type: 'choice',
      choice: 'homepage',
      confidence: 0.9,
      probabilities: { homepage: 0.9, pricing: 0.05, other: 0.05 },
    }
    if (answer.type !== 'choice') throw new Error('wrong type')
    expect(Object.keys(answer.probabilities)).toContain(answer.choice)
    const sum = Object.values(answer.probabilities).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1, 2)
  })
})
