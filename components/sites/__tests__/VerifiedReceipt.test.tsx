import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VerifiedReceipt, fixedInLabel } from '../VerifiedReceipt'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'

const C = SITE_DASHBOARD_COPY.verifiedReceipt
const proof = { observedAt: '2026-11-10T09:14:00.000Z', auditId: 'audit-2', showAuditId: false, observation: 'The cart shows the product after Add to cart.' }

describe('Verified receipt', () => {
  it('states how long the fix took, only when both times are recorded and ordered', () => {
    expect(fixedInLabel('2026-11-10T09:00:00.000Z', '2026-11-10T09:14:00.000Z')).toBe('14 minutes')
    expect(fixedInLabel('2026-11-10T06:00:00.000Z', '2026-11-10T09:00:00.000Z')).toBe('3 hours')
    expect(fixedInLabel('2026-11-01T09:00:00.000Z', '2026-11-10T09:00:00.000Z')).toBe('9 days')
    expect(fixedInLabel('2026-11-10T09:00:00.000Z', '2026-11-10T09:01:00.000Z')).toBe('1 minute')
    expect(fixedInLabel(null, proof.observedAt)).toBeNull()
    expect(fixedInLabel('2026-11-10T10:00:00.000Z', proof.observedAt)).toBeNull()
  })

  it('shows the stamp, page, times, duration and the independent recheck', () => {
    render(<VerifiedReceipt heading="The problem is fixed" proof={proof} page="https://shop.example/products/tote" foundAt="2026-11-10T09:00:00.000Z" />)
    expect(screen.getByRole('region', { name: 'The problem is fixed' })).toBeVisible()
    expect(screen.getByLabelText(C.label)).toHaveTextContent(C.stamp)
    expect(screen.getByText('/products/tote')).toBeVisible()
    expect(screen.getByText('14 minutes')).toBeVisible()
    expect(screen.getByText(C.independent)).toBeVisible()
    expect(screen.getByText(proof.observation)).toBeVisible()
  })

  it('leaves out rows it cannot support', () => {
    render(<VerifiedReceipt heading="Fixed" proof={{ ...proof, observedAt: null }} page={null} foundAt={null} />)
    expect(screen.queryByText(C.page)).not.toBeInTheDocument()
    expect(screen.queryByText(C.fixedIn)).not.toBeInTheDocument()
  })
})
