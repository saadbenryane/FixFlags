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

function receiptFor(report, improvementId, expectedOutcome) {
  const receipt = report.verificationReceipts?.find(
    (candidate) => candidate.improvementId === improvementId,
  )
  if (!receipt) throw new Error(`${expectedOutcome} dogfood receipt is missing`)
  if (receipt.outcome !== expectedOutcome) {
    throw new Error(`Expected ${expectedOutcome}, received ${receipt.outcome ?? 'no outcome'}`)
  }
  const coverage = receipt.verificationCoverage
  if (expectedOutcome === 'IMPROVED') {
    if (receipt.comparable !== true || coverage?.verifierExecuted !== true) {
      throw new Error('IMPROVED dogfood receipt lacks comparable positive verifier evidence')
    }
    if (!receipt.evidenceReference?.beforeFlagId || !receipt.evidenceReference?.afterAuditId) {
      throw new Error('IMPROVED dogfood receipt lacks before/after evidence identifiers')
    }
  } else if (receipt.comparable !== false || !receipt.verificationReason) {
    throw new Error('INCONCLUSIVE dogfood receipt does not explain unavailable evidence')
  }
  return {
    improvementId,
    attemptId: receipt.attemptId,
    outcome: receipt.outcome,
    comparable: receipt.comparable,
    verificationReason: receipt.verificationReason,
  }
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
  const improvedReportId = required('PRODUCTION_DOGFOOD_IMPROVED_REPORT_ID')
  const inconclusiveReportId = required('PRODUCTION_DOGFOOD_INCONCLUSIVE_REPORT_ID')
  const productReportId = required('PRODUCTION_DOGFOOD_PRODUCT_REPORT_ID')
  const [improvedReport, inconclusiveReport, productContext] = await Promise.all([
    callTool(endpoint, apiKey, 2, 'ff_get_report', { reportId: improvedReportId }),
    callTool(endpoint, apiKey, 3, 'ff_get_report', { reportId: inconclusiveReportId }),
    callTool(endpoint, apiKey, 4, 'ff_get_product_context', { reportId: productReportId }),
  ])
  const improvedId = required('PRODUCTION_DOGFOOD_IMPROVED_IMPROVEMENT_ID')
  const inconclusiveId = required('PRODUCTION_DOGFOOD_INCONCLUSIVE_IMPROVEMENT_ID')
  const improved = receiptFor(improvedReport, improvedId, 'IMPROVED')
  const inconclusive = receiptFor(inconclusiveReport, inconclusiveId, 'INCONCLUSIVE')
  const history = productContext.improvementHistory ?? []
  const improvedHistory = history.find((item) => item.id === improvedId)
  const inconclusiveHistory = history.find((item) => item.id === inconclusiveId)
  const improvedAttempt = improvedHistory?.attempts?.find((item) => item.id === improved.attemptId)
  if (!improvedAttempt?.changeSummary || !improvedAttempt?.deploymentReference) {
    throw new Error('Production IMPROVED attempt lacks a real change summary or deployment reference')
  }
  const learnings = productContext.productIntelligence?.verifiedLearnings ?? []
  if (!learnings.some((learning) => learning.improvementId === improvedId)) {
    throw new Error('Verified IMPROVED learning is missing from Product Memory')
  }
  if (learnings.some((learning) => learning.improvementId === inconclusiveId)) {
    throw new Error('INCONCLUSIVE dogfood result incorrectly entered Product Memory')
  }
  if (!inconclusiveHistory) throw new Error('INCONCLUSIVE Improvement is missing from Product history')

  const evidence = {
    schemaVersion: 1,
    targetOrigin: origin,
    improved,
    inconclusive,
    memory: { improvedRecorded: true, inconclusiveExcluded: true },
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
