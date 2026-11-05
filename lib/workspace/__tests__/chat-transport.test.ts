import OpenAI from 'openai'
import { createServer } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'

const settings = vi.hoisted(() => ({ baseURL: undefined as string | undefined, shared: null as OpenAI | null }))
vi.mock('@/lib/audit/judge-runner', () => ({ get openai() { return settings.shared } }))
vi.mock('@/lib/audit/llm-keys', () => ({ getOpenAIProviderKey: () => 'local-chat-fixture' }))
vi.mock('@/lib/audit/judge-config', () => ({
  getChatProviderConfig: () => ({ model: 'chat-fixture', maxTokens: 600, timeoutMs: 100 }),
}))
vi.mock('@/lib/env', async original => ({
  ...await original<typeof import('@/lib/env')>(),
  getEnv: () => ({ CHAT_BASE_URL: settings.baseURL }),
}))

const input = { message: 'Explain this observation.', url: 'https://example.test/', status: 'COMPLETED', flags: [] }

describe('installed chat SDK transport', () => {
  afterEach(() => { settings.baseURL = undefined; settings.shared = null; vi.resetModules() })

  for (const gateway of [false, true]) {
    const path = gateway ? 'configured gateway' : 'shared client'
    it(`makes one request after a provider refusal through the ${path}`, async () => {
      let requests = 0
      const server = createServer((_request, response) => {
        requests++
        response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '0.01' })
        response.end(JSON.stringify({ error: { type: 'insufficient_quota', message: 'Controlled local refusal' } }))
      })
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
      settings.baseURL = gateway ? origin : undefined
      // Native defaults allow two hidden retries. The chat request must override them.
      settings.shared = new OpenAI({ apiKey: 'local-chat-fixture', baseURL: origin })
      try {
        const { runWorkspaceChat } = await import('../chat')
        await expect(runWorkspaceChat(input)).rejects.toThrow('Workspace chat is unavailable')
        expect(requests).toBe(1)
      } finally {
        server.closeAllConnections()
        await new Promise<void>(resolve => server.close(() => resolve()))
      }
    })

    it(`closes a stalled request at the configured deadline through the ${path}`, async () => {
      let requests = 0, closed = false, finished = false
      const server = createServer((_request, response) => {
        requests++
        response.on('close', () => { closed = true })
      })
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
      const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
      settings.baseURL = gateway ? origin : undefined
      settings.shared = new OpenAI({ apiKey: 'local-chat-fixture', baseURL: origin })
      const { runWorkspaceChat } = await import('../chat')
      const settled = runWorkspaceChat(input).catch(error => error).finally(() => { finished = true })
      try {
        await vi.waitFor(() => expect(finished && closed).toBe(true), { timeout: 2000 })
        expect(await settled).toMatchObject({ message: 'Workspace chat is unavailable' })
        expect(requests).toBe(1)
      } finally {
        server.closeAllConnections()
        await settled
        await new Promise<void>(resolve => server.close(() => resolve()))
      }
    })
  }
})
