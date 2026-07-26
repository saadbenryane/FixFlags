import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeveritySignal } from '@/components/report/SeveritySignal'

describe('SeveritySignal', () => {
  it('reserves the alert icon for Critical Flags', () => {
    const important = render(<SeveritySignal severity="IMPORTANT" />)
    expect(important.container.querySelector('.lucide-circle-alert')).toBeNull()
    important.unmount()

    const critical = render(<SeveritySignal severity="CRITICAL" />)
    expect(critical.container.querySelector('.lucide-circle-alert')).not.toBeNull()
  })
})
