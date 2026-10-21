import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nativeHttpCollection, nativeHttpEvidenceSchema } from '../native-http-evidence'
import { openCheckDestination, type OpenCheckResult } from '../open-check'
import { safeFetchResource } from '../url'
import { runAuthCheckoutChecks } from '../checks/auth-checkout'
import { runOgImageUrlCheck } from '../checks/metadata-checks'
import { parseMetadataFromHtml } from '../metadata'
import type { CheckAssertion } from '../checks/assertion'
import { evaluatorHandlers } from '../progressive/evaluators'
import { serializeArtifact } from '../progressive/contracts'
import type { TaskContext } from '../progressive/registry'
import { CHECK_REGISTRY } from '../check-registry'

vi.mock('../open-check', async original => ({ ...await original<typeof import('../open-check')>(), openCheckDestination: vi.fn() }))
vi.mock('../url', async original => ({ ...await original<typeof import('../url')>(), safeFetchResource: vi.fn() }))
const pageUrl = 'https://example.com/pricing', imageUrl = 'https://example.com/preview.png'
const metadata = parseMetadataFromHtml('<html><head><meta property="og:image" content="' + imageUrl + '"></head><body><a href="/signup">Sign up</a><a href="/checkout">Buy now</a></body></html>', pageUrl)
const response = { statusCode: 404, headers: { 'content-type': 'text/plain', 'set-cookie': 'private' }, body: Buffer.from('Missing'), complete: true, finalUrl: imageUrl, redirects: [] }
beforeEach(() => { vi.mocked(openCheckDestination).mockReset(); vi.mocked(safeFetchResource).mockReset() })

describe('private native HTTP evidence', () => {
  it('replays action decisions and their assertions without another public request', async () => {
    vi.mocked(openCheckDestination).mockImplementation(async url => ({ url, canonicalUrl: url, outcome: 'not_found',
      status: 404, finalUrl: url, evidence: 'HTTP 404', shouldFlagDead: true }))
    const collected = nativeHttpCollection(), assertions: CheckAssertion[] = [], scope = {}
    const flags = await runAuthCheckoutChecks(pageUrl, metadata, { ...collected.options, record: assertion => assertions.push(assertion), scope })
    const recorded = nativeHttpEvidenceSchema.parse(JSON.parse(JSON.stringify(collected.snapshot())))
    expect(recorded.requests).toHaveLength(2)
    vi.mocked(openCheckDestination).mockRejectedValue(new Error('No fresh network allowed'))
    const replay = nativeHttpCollection(recorded), replayAssertions: CheckAssertion[] = [], replayScope = {}
    expect(await runAuthCheckoutChecks(pageUrl, metadata, { ...replay.options, record: assertion => replayAssertions.push(assertion), scope: replayScope })).toEqual(flags)
    expect(replayAssertions).toEqual(assertions)
    expect(replayScope).toEqual(scope)
    expect(replay.snapshot()).toEqual(recorded)
    expect(openCheckDestination).toHaveBeenCalledTimes(2)
  })

  it.each([
    { status: 200, type: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAFElEQVQImWP4r8TwX4kBhP8rMQAAI6YEhXbc9zcAAAAASUVORK5CYII=', 'base64'), flags: 0 },
    { status: 404, type: 'text/plain', body: Buffer.from('Missing'), flags: 1 },
    { status: 200, type: 'image/png', body: '', flags: 1 },
    { status: 403, type: 'text/html', body: 'Refused', flags: 0 },
  ])('replays the consumed image response facts for HTTP $status', async ({ status, type, body, flags }) => {
    vi.mocked(safeFetchResource).mockResolvedValue({ ...response, statusCode: status, body: Buffer.from(body), headers: { 'content-type': type, 'set-cookie': 'private' } })
    const collected = nativeHttpCollection(), scope = {}, assertions: CheckAssertion[] = []
    const original = await runOgImageUrlCheck(pageUrl, metadata, { ...collected.options, scope, record: value => assertions.push(value) })
    expect(original).toHaveLength(flags)
    const recorded = collected.snapshot()
    expect(JSON.stringify(recorded)).not.toContain('set-cookie')
    const replay = nativeHttpCollection(recorded), replayScope = {}, replayAssertions: CheckAssertion[] = []
    expect(await runOgImageUrlCheck(pageUrl, metadata, { ...replay.options, scope: replayScope, record: value => replayAssertions.push(value) })).toEqual(original)
    expect(replayAssertions).toEqual(assertions)
    expect(replayScope).toEqual(scope)
    expect(replay.snapshot()).toEqual(recorded)
    expect(safeFetchResource).toHaveBeenCalledTimes(1)
  })

  it('retains unavailable collection and refuses missing or unused replay inputs', async () => {
    vi.mocked(safeFetchResource).mockRejectedValue(new Error('Transport unavailable'))
    const collected = nativeHttpCollection(), assertions: CheckAssertion[] = []
    expect(await runOgImageUrlCheck(pageUrl, metadata, { ...collected.options, record: value => assertions.push(value) })).toEqual([])
    expect(assertions[0]).toMatchObject({ passed: false, complete: false })
    const recorded = collected.snapshot(), replay = nativeHttpCollection(recorded)
    expect(await runOgImageUrlCheck(pageUrl, metadata, replay.options)).toEqual([])
    expect(replay.snapshot()).toEqual(recorded)
    expect(() => nativeHttpCollection(recorded).snapshot()).toThrow('NATIVE_HTTP_REPLAY_INPUT_MISMATCH')
    const changed = nativeHttpCollection(recorded)
    await runOgImageUrlCheck(pageUrl, { ogImage: imageUrl + '?different=1' }, changed.options)
    expect(() => changed.snapshot()).toThrow('NATIVE_HTTP_REPLAY_INPUT_MISMATCH')
    expect(safeFetchResource).toHaveBeenCalledTimes(1)
  })

  it('retains the access-challenge header used by image evaluation', async () => {
    vi.mocked(safeFetchResource).mockResolvedValue({ ...response, statusCode: 200,
      headers: { 'content-type': 'image/png', 'cf-mitigated': 'challenge', 'set-cookie': 'private' } })
    const collected = nativeHttpCollection(), assertions: CheckAssertion[] = []
    expect(await runOgImageUrlCheck(pageUrl, metadata, { ...collected.options, record: value => assertions.push(value) })).toEqual([])
    expect(assertions[0]).toMatchObject({ passed: false, complete: false })
    const recorded = collected.snapshot(), replay = nativeHttpCollection(recorded), replayAssertions: CheckAssertion[] = []
    await runOgImageUrlCheck(pageUrl, metadata, { ...replay.options, record: value => replayAssertions.push(value) })
    expect(replayAssertions).toEqual(assertions)
    expect(replay.snapshot()).toEqual(recorded)
    expect(JSON.stringify(recorded)).not.toContain('set-cookie')
    expect(safeFetchResource).toHaveBeenCalledTimes(1)
  })

  it('keeps multi-action findings in source order when collection finishes out of order', async () => {
    const pending: Array<(result: OpenCheckResult) => void> = []
    vi.mocked(openCheckDestination).mockImplementation(() => new Promise(resolve => pending.push(resolve)))
    const result = runAuthCheckoutChecks(pageUrl, { ...metadata, links: [{ href: '/a', text: 'Buy now', rel: null }, { href: '/b', text: 'Buy now', rel: null }] })
    const failure = (path: string): OpenCheckResult => ({ url: 'https://example.com' + path, canonicalUrl: path, outcome: 'not_found', status: 404,
      finalUrl: 'https://example.com' + path, evidence: 'HTTP 404', shouldFlagDead: true })
    pending[1](failure('/b')); pending[0](failure('/a'))
    expect((await result)[0].evidence).toBe('https://example.com/a; https://example.com/b')
  })

  it('retains exact request membership without storing signed query values or response text', async () => {
    const secretUrl = 'https://example.com/checkout?token=PRIVATE_VALUE'
    vi.mocked(openCheckDestination).mockResolvedValue({ url: secretUrl, canonicalUrl: secretUrl, outcome: 'not_found', status: 404,
      finalUrl: secretUrl, evidence: 'GET ' + secretUrl + ' returned 404.', shouldFlagDead: true })
    vi.mocked(safeFetchResource).mockResolvedValue({ ...response, body: Buffer.from('PRIVATE_BODY'), headers: { 'content-type': 'text/plain', 'set-cookie': 'PRIVATE_COOKIE' } })
    const collected = nativeHttpCollection()
    const action = await collected.options.openDestination(secretUrl)
    const image = await collected.options.observeImage(imageUrl, { timeoutMs: 5000, maxBytes: 64_000, accept: 'image/*' })
    const recorded = collected.snapshot()
    expect(JSON.stringify(recorded)).not.toMatch(/PRIVATE_|token=|set-cookie/)
    const replay = nativeHttpCollection(recorded)
    expect(await replay.options.openDestination(secretUrl)).toEqual({ url: action.url, outcome: action.outcome, status: action.status, shouldFlagDead: action.shouldFlagDead })
    expect(await replay.options.observeImage(imageUrl, { timeoutMs: 5000, maxBytes: 64_000, accept: 'image/*' })).toEqual(image)
    expect(replay.snapshot()).toEqual(recorded)
    expect(openCheckDestination).toHaveBeenCalledTimes(1)
    expect(safeFetchResource).toHaveBeenCalledTimes(1)
  })

  it('persists the secondary inputs in the actual evaluator artifact and replays the complete receipt', async () => {
    vi.mocked(safeFetchResource).mockResolvedValue(response)
    const context = { audit: { id: 'audit', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
      environment: 'production', scope: 'SITE', checks: { 'og-image-broken': CHECK_REGISTRY['og-image-broken'].version }, outcomes: [], verificationTarget: null } },
      task: { id: 'task' }, input: { pageUrl, position: 0, primary: true, role: 'primary', module: 'og-image' }, deadline: Date.now() + 12_000,
      dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED', workResult: serializeArtifact('browser', {
        pageId: 'page', metadata, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null, desktopBase64: null, mobileBase64: null,
          consoleErrors: [], captureFailures: [], captureStatus: { desktop: 'ok', mobile: 'ok' } },
      }) }]]),
    } as unknown as TaskContext
    const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
    const artifact = await evaluate(context)
    const http = nativeHttpEvidenceSchema.parse(artifact.data.httpEvidence)
    expect(http.requests).toHaveLength(1)
    expect(artifact.data.flags).toHaveLength(1)
    const replay = await evaluate({ ...context, replayHttpEvidence: http })
    expect(replay.data).toEqual(artifact.data)
    expect(safeFetchResource).toHaveBeenCalledTimes(1)
  })
})
