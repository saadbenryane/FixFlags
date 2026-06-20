import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import {
  buildAttribution,
  inferAuditSource,
  parseClientAuditSource,
} from '@/lib/leads/attribution'

describe('audit attribution', () => {
  it('infers source from pathname', () => {
    assert.equal(inferAuditSource('/'), 'HOMEPAGE')
    assert.equal(inferAuditSource('/dashboard'), 'DASHBOARD')
    assert.equal(inferAuditSource('/report/abc'), 'REPORT')
    assert.equal(inferAuditSource('/api/mcp'), 'MCP')
    assert.equal(inferAuditSource('/pricing'), 'UNKNOWN')
  })

  it('builds attribution with explicit source and UTM params', () => {
    const params = new URLSearchParams('utm_source=google&utm_medium=cpc&utm_campaign=launch')
    const attr = buildAttribution({
      url: 'https://example.com',
      source: 'HOMEPAGE',
      pathname: '/',
      searchParams: params,
    })
    assert.equal(attr.normalizedDomain, 'example.com')
    assert.equal(attr.source, 'HOMEPAGE')
    assert.equal(attr.utmSource, 'google')
    assert.equal(attr.utmMedium, 'cpc')
    assert.equal(attr.utmCampaign, 'launch')
  })

  it('accepts MCP and dashboard client sources', () => {
    assert.equal(parseClientAuditSource('mcp'), 'MCP')
    assert.equal(parseClientAuditSource('dashboard'), 'DASHBOARD')
    assert.equal(parseClientAuditSource('homepage'), 'HOMEPAGE')
    assert.equal(parseClientAuditSource('invalid'), undefined)
  })
})
