#!/usr/bin/env node

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function parseRpcResponse(text) {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return JSON.parse(trimmed)
  const data = trimmed
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .at(-1)
  if (!data) throw new Error('MCP returned no JSON-RPC payload')
  return JSON.parse(data)
}

async function rpc(endpoint, apiKey, body) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`MCP request failed (${response.status})`)
  const payload = parseRpcResponse(await response.text())
  if (payload.error) throw new Error(`MCP error: ${payload.error.message ?? 'unknown error'}`)
  return payload.result
}

async function callTool(endpoint, apiKey, id, name, args) {
  const result = await rpc(endpoint, apiKey, {
    jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args },
  })
  const block = result?.content?.find((item) => item.type === 'text')
  if (!block?.text) throw new Error(`${name} returned no text result`)
  return JSON.parse(block.text)
}

async function main() {
  const origin = new URL(required('PRODUCTION_URL')).origin
  if (!['fixflags.com', 'www.fixflags.com'].includes(new URL(origin).hostname)) {
    throw new Error('Production dogfood must target the canonical production origin')
  }
  const endpoint = `${origin}/api/mcp`
  const apiKey = required('PRODUCTION_API_KEY')
  await rpc(endpoint, apiKey, {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'fixflags-release-dogfood', version: '1' } },
  })
  const siteId = required('PRODUCTION_DOGFOOD_SITE_ID')
  const runId = required('PRODUCTION_DOGFOOD_CLEAR_RUN_ID')
  const flagId = required('PRODUCTION_DOGFOOD_FLAG_ID')
  const attemptId = required('PRODUCTION_DOGFOOD_ATTEMPT_ID')
  const [connection, run, flagResult] = await Promise.all([
    callTool(endpoint, apiKey, 2, 'fixflags.get_connection_info', {}),
    callTool(endpoint, apiKey, 3, 'fixflags.get_run', { runId }),
    callTool(endpoint, apiKey, 4, 'fixflags.get_flag', { siteId, flagId }),
  ])
  if (connection.contractVersion !== '3.0' || connection.protocolVersion !== '2026-07-28') {
    throw new Error('Production MCP is not serving the launch contract')
  }
  if (run.status !== 'COMPLETED' || run.result !== 'CLEAR') {
    throw new Error(`Production run is not independently Clear (${run.status}/${run.result})`)
  }
  const attempt = flagResult.flag?.attempts?.find((candidate) => candidate.id === attemptId)
  if (!attempt || attempt.outcome !== 'IMPROVED' || attempt.comparable !== true) {
    throw new Error('Production Flag lacks a comparable IMPROVED verification attempt')
  }
  if (!attempt.changeSummary) throw new Error('Production fix attempt lacks change context')

  const evidence = {
    schemaVersion: 2,
    targetOrigin: origin,
    contractVersion: connection.contractVersion,
    siteId,
    runId,
    result: run.result,
    flagId,
    attemptId,
    verification: { outcome: attempt.outcome, comparable: attempt.comparable },
  }
  const target = required('RELEASE_DOGFOOD_EVIDENCE_FILE')
  mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  writeFileSync(target, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 })
  chmodSync(target, 0o600)
  console.log('Production dogfood evidence PASS')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
