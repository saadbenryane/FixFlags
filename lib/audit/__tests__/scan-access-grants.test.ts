import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptScanAccess, decryptScanAccess, parseScanAccessInput, scanAccessToFetchHeaders, scanAccessToPlaywrightContext, applyScanAccessCookies } from '../scan-access'
import { readProjectAccessGrant, writeProjectAccessGrant, ScanAccessUnavailable } from '../scan-access-grants'
import { admitScanAccess, resolveAuditScanAccess } from '../scan-access-store'
import { captureAccessKey } from '../browser/observation-scope'

const db = vi.hoisted(() => ({ audit: { findUnique: vi.fn() }, project: { findFirst: vi.fn() } }))
vi.mock('@/lib/db', () => ({ prisma: db }))
const url = 'https://preview.example.com/'
const config = { httpBasic: { username: 'owner', password: 'PRIVATE_PASSWORD' }, headers: { 'X-Preview': 'PRIVATE_HEADER' }, cookies: [{ name: 'session', value: 'PRIVATE_COOKIE' }] }
const spec = { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'SITE', checks: {}, outcomes: [], verificationTarget: null }
beforeEach(() => { vi.clearAllMocks(); process.env.TOKEN_ENCRYPTION_KEY = '11'.repeat(32) })

describe('sealed scan access permission', () => {
  it('keeps note changes authorized but never revives a revoked grant when the same secret is restored', async () => {
    const first = writeProjectAccessGrant(config, url)
    const grant = readProjectAccessGrant(first.payload, url)
    const project = { id: 'site', url, userId: 'owner', scanAccessAuthorizedByUserId: 'owner', deletedAt: null, scanAccessEncrypted: first.payload }
    const audit = { url, userId: 'owner', projectId: 'site', project, scanAccessEncrypted: encryptScanAccess(config),
      executionSpec: { ...spec, scanAccess: { kind: 'project', origin: grant.origin, projectId: 'site', reference: grant.reference } } }
    db.audit.findUnique.mockImplementation(async () => audit)
    expect(await resolveAuditScanAccess('audit')).toMatchObject({ origin: 'https://preview.example.com', httpBasic: config.httpBasic })
    const note = writeProjectAccessGrant({ ...config, label: 'Changed handoff note' }, url, grant)
    expect(note.changed).toBe(false)
    project.scanAccessEncrypted = note.payload
    expect(await resolveAuditScanAccess('audit')).not.toBeNull()
    const cleared = writeProjectAccessGrant(null, url, readProjectAccessGrant(note.payload, url))
    project.scanAccessEncrypted = cleared.payload
    await expect(resolveAuditScanAccess('audit')).rejects.toBeInstanceOf(ScanAccessUnavailable)
    project.scanAccessEncrypted = writeProjectAccessGrant(config, url, readProjectAccessGrant(cleared.payload, url)).payload
    await expect(resolveAuditScanAccess('audit')).rejects.toBeInstanceOf(ScanAccessUnavailable)
    expect(decryptScanAccess(project.scanAccessEncrypted)).toEqual(config)
  })
  it('seals public and one-off access instead of inheriting a later Site grant', async () => {
    db.project.findFirst.mockResolvedValue({ id: 'site', url, userId: 'owner', deletedAt: null, scanAccessEncrypted: encryptScanAccess(config) })
    const publicDecision = await admitScanAccess(db as never, { projectId: 'site', userId: 'owner', targetUrl: url, useProject: false })
    db.audit.findUnique.mockResolvedValue({ url, userId: 'owner', scanAccessEncrypted: null, projectId: 'site',
      project: { id: 'site', url, userId: 'owner', deletedAt: null, scanAccessEncrypted: encryptScanAccess(config) }, executionSpec: { ...spec, scanAccess: publicDecision.intent } })
    expect(await resolveAuditScanAccess('audit')).toBeNull()
    expect((await admitScanAccess(db as never, { projectId: 'site', userId: 'owner', targetUrl: url, explicit: null })).intent.kind).toBe('public')
    await expect(admitScanAccess(db as never, { projectId: null, userId: null, targetUrl: url, explicit: config })).rejects.toBeInstanceOf(ScanAccessUnavailable)
  })
  it('does not replay legacy Audit ciphertext without a matching live Site grant', async () => {
    const project = { id: 'site', url, userId: 'owner', scanAccessAuthorizedByUserId: 'owner', deletedAt: null, scanAccessEncrypted: encryptScanAccess(config) as string | null }
    db.audit.findUnique.mockImplementation(async () => ({ url, userId: 'owner', projectId: 'site', project,
      scanAccessEncrypted: encryptScanAccess(config), executionSpec: spec }))
    expect(await resolveAuditScanAccess('audit')).not.toBeNull()
    project.scanAccessEncrypted = null
    await expect(resolveAuditScanAccess('audit')).rejects.toBeInstanceOf(ScanAccessUnavailable)
    project.scanAccessEncrypted = writeProjectAccessGrant(config, url).payload
    await expect(resolveAuditScanAccess('audit')).rejects.toBeInstanceOf(ScanAccessUnavailable)
  })
  it('keeps the approved origin after the Site URL changes and binds default cookies to that host', async () => {
    const grant = readProjectAccessGrant(writeProjectAccessGrant(config, url).payload, 'http://preview.example.com:8080')
    const access = { ...grant.config!, origin: grant.origin }
    expect(scanAccessToFetchHeaders(access, url).Authorization).toMatch(/^Basic /)
    expect(scanAccessToFetchHeaders(access, 'http://preview.example.com:8080')).toEqual({})
    expect(scanAccessToPlaywrightContext(access, 'https://www.preview.example.com').httpCredentials).toMatchObject({ origin: 'https://preview.example.com' })
    expect(captureAccessKey(access, url)).toBe(captureAccessKey(access))
    expect(captureAccessKey(access, 'https://www.preview.example.com')).not.toBe(captureAccessKey(access))
    const cookiesOnly = { origin: access.origin, cookies: access.cookies }
    expect(captureAccessKey(cookiesOnly, 'https://www.preview.example.com')).toBe(captureAccessKey(cookiesOnly))
    const cookies = vi.fn()
    await applyScanAccessCookies({ addCookies: cookies }, 'https://other.example/', access)
    expect(cookies).toHaveBeenCalledWith([{ name: 'session', value: 'PRIVATE_COOKIE', domain: 'preview.example.com', path: '/' }])
    expect(parseScanAccessInput({ ...config, origin: 'https://attacker.example' })).not.toHaveProperty('origin')
  })
  it('can revoke access without an encryption key and refuses malformed permission metadata', async () => {
    const previous = readProjectAccessGrant(writeProjectAccessGrant(config, url).payload, url)
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', '')
    try { expect(readProjectAccessGrant(writeProjectAccessGrant(null, url, previous).payload, url).config).toBeNull() }
    finally { vi.unstubAllEnvs() }
    db.audit.findUnique.mockResolvedValue({ url, userId: 'owner', scanAccessEncrypted: encryptScanAccess(config),
      executionSpec: { ...spec, scanAccess: { kind: 'project', origin: url } } })
    await expect(resolveAuditScanAccess('audit')).rejects.toBeInstanceOf(ScanAccessUnavailable)
  })
})
