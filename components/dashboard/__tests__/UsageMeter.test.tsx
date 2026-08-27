import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HELP_CENTER, USAGE_METER_COPY } from '@/lib/marketing/copy'
import { UsageMeter } from '@/components/dashboard/UsageMeter'

describe('UsageMeter', () => {
  it('shows used of the plan total on the compact dashboard meter', () => {
    const { container } = render(
      <UsageMeter variant="compact" used={1} limit={3} pending={0} plan="FREE" />,
    )

    expect(
      screen.getByRole('region', { name: USAGE_METER_COPY.regionLabel }),
    ).toBeInTheDocument()
    expect(screen.getByText(USAGE_METER_COPY.usedOfLimit(1, 3))).toBeInTheDocument()
    expect(screen.getByText(USAGE_METER_COPY.remainingShort(2), { exact: false })).toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: USAGE_METER_COPY.progressLabel(1, 3) }),
    ).toBeInTheDocument()
    expect(container.querySelector('.text-3xl')).toBeNull()
  })

  it('shows used of the plan total with a progress bar on billing', () => {
    const { container } = render(
      <UsageMeter used={2} limit={3} pending={0} plan="FREE" />,
    )

    expect(screen.getByText(USAGE_METER_COPY.panelLabel)).toBeInTheDocument()
    expect(screen.getByText(USAGE_METER_COPY.usedOfLimit(2, 3))).toBeInTheDocument()
    expect(screen.getByText(USAGE_METER_COPY.usedCaption)).toBeInTheDocument()
    expect(screen.queryByText(USAGE_METER_COPY.remainingCaption(1))).not.toBeInTheDocument()
    expect(
      screen.getByRole('progressbar', { name: USAGE_METER_COPY.progressLabel(2, 3) }),
    ).toBeInTheDocument()
    expect(container.querySelector('.shadow-card')).toBeNull()
    expect(screen.queryByText('product reviews remaining')).not.toBeInTheDocument()
  })

  it('omits inline upgrade links when the page owns the upgrade CTA', () => {
    render(
      <UsageMeter
        used={3}
        limit={3}
        pending={0}
        plan="FREE"
        showUpgradeCta={false}
      />,
    )

    expect(screen.getByText(USAGE_METER_COPY.limitReached)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: USAGE_METER_COPY.upgradeToPro })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: HELP_CENTER.viewHelpCta })).toBeInTheDocument()
  })

  it('keeps an uncapped period count when the plan is unlimited', () => {
    render(<UsageMeter used={2} limit={null} pending={0} plan="FREE" />)

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(USAGE_METER_COPY.thisPeriodCaption(2))).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
