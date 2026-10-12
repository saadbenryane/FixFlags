import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encryptSecret } from '@/lib/security/crypto'
import { loadAccountChecksView } from '../store'

const project = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ prisma: { project: { findFirst: project } } }))
vi.mock('@/lib/billing/beta-policy', () => ({ hasOpenBetaAccess: () => false }))
beforeEach(() => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', '11'.repeat(32))
  vi.stubEnv('ACCOUNT_CHECKS_ENABLED', 'false')
  vi.stubEnv('ACCOUNT_CHECKS_LIFECYCLE_VERIFIED', 'false')
  vi.stubEnv('RESEND_API_KEY', '')
  vi.stubEnv('RESEND_RECEIVING_WEBHOOK_SECRET', '')
})
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })
function fixture(encryptedPassword = encryptSecret('private-password'), submittedAt: Date | null = new Date()) {
  return { accountChecksEnabled: false, user: { role: 'user', plan: 'BUILDER', subscriptionStatus: 'CANCELED' },
    testAccounts: [{ email: 'test@example.test', purpose: 'retained', state: 'ACTIVE', encryptedPassword, submittedAt }], accountCheckReceipts: [] }
}

describe('owning account cleanup projection', () => {
  it('permits cleanup with usable credentials despite missing mailbox, paused checks and canceled entitlement', async () => {
    project.mockResolvedValue(fixture())
    const view = await loadAccountChecksView('owned-site')
    expect(view).toMatchObject({ enabled: false, eligible: false, ready: false, canCleanup: true, cleanupUnavailableReason: null })
    expect(view.accounts).toEqual([{ email: 'test@example.test', purpose: 'retained', state: 'ACTIVE' }])
    expect(JSON.stringify(view)).not.toContain('private-password')
    expect(JSON.stringify(view)).not.toContain('encryptedPassword')
    expect(project).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'owned-site', deletedAt: null } }))
  })
  it('refuses a submitted account whose stored secret cannot be decrypted', async () => {
    project.mockResolvedValue(fixture('corrupt-ciphertext'))
    expect(await loadAccountChecksView('owned-site')).toMatchObject({ canCleanup: false, cleanupUnavailableReason: expect.any(String) })
  })
  it('still permits reconciling a reserved identity that has never been submitted', async () => {
    const row = fixture('corrupt-ciphertext', null); row.testAccounts[0].state = 'RESERVED'
    project.mockResolvedValue(row)
    expect(await loadAccountChecksView('owned-site')).toMatchObject({ canCleanup: true })
  })
  it('does not offer cleanup for an absent Site or only deleted accounts', async () => {
    project.mockResolvedValue(null)
    expect(await loadAccountChecksView('absent')).toMatchObject({ canCleanup: false, cleanupUnavailableReason: null, accounts: [] })
    const row = fixture(); row.testAccounts[0].state = 'DELETED'; project.mockResolvedValue(row)
    expect(await loadAccountChecksView('owned-site')).toMatchObject({ canCleanup: false, cleanupUnavailableReason: null })
  })
  it('refuses cleanup after encryption configuration is lost', async () => {
    project.mockResolvedValue(fixture()); vi.stubEnv('TOKEN_ENCRYPTION_KEY', '')
    expect(await loadAccountChecksView('owned-site')).toMatchObject({ canCleanup: false, cleanupUnavailableReason: expect.any(String) })
  })
})
