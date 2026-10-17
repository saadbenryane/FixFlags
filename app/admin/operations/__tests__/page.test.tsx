import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ read: vi.fn(), guard: vi.fn() }))
vi.mock('@/lib/auth/require-admin-page', () => ({ requireAdminPage: state.guard }))
vi.mock('@/lib/admin/operations', () => ({ loadOperations: state.read,
  OPERATION_QUEUES: [{ id: 'tasks', label: 'Incomplete execution history' }] }))
vi.mock('@/components/admin/AdminActionButton', () => ({ AdminActionButton: () => <button>Mutation action</button> }))
import OperationsPage from '../page'

describe('operator incomplete execution history', () => {
  beforeEach(() => {
    state.guard.mockReset().mockResolvedValue({ id: 'admin' })
    state.read.mockReset().mockResolvedValue({ worker: 'Ready', queue: 'tasks', counts: [1], total: 1,
      pagination: { page: 1, pages: 1 }, rows: [{ id: 'task', siteId: 'site', label: 'Controlled website',
        state: 'EXHAUSTED · PROVIDER_UNAVAILABLE', at: new Date(), action: null, targetId: 'original-audit',
        auditId: 'original-audit' }] })
  })
  it('links the exact original report without offering unrelated Site reconciliation', async () => {
    render(await OperationsPage({ searchParams: Promise.resolve({ queue: 'tasks' }) }))
    expect(screen.getByRole('link', { name: 'Inspect check' })).toHaveAttribute('href', '/admin/audits/original-audit')
    expect(screen.queryByRole('button', { name: 'Mutation action' })).not.toBeInTheDocument()
  })
  it('requires administrator access before reading execution history', async () => {
    state.guard.mockRejectedValue(new Error('forbidden'))
    await expect(OperationsPage({ searchParams: Promise.resolve({ queue: 'tasks' }) })).rejects.toThrow('forbidden')
    expect(state.read).not.toHaveBeenCalled()
  })
})
