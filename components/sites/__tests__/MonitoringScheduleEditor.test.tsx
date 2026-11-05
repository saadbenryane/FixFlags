import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { MonitoringScheduleEditor } from '../MonitoringScheduleEditor'
import { MONITORING_SCHEDULE_COPY as C } from '@/lib/marketing/copy/monitoring'
import { SCAN_LIMIT_GATE } from '@/lib/marketing/copy-barrel'

const upgradeLabel = SCAN_LIMIT_GATE.upgrade.secondaryCta

it.each(['loading', 'failed'] as const)('does not infer a plan restriction from %s monitoring options', state => {
  render(<MonitoringScheduleEditor open schedule={{ every: 1, unit: 'days' }} availableIntervals={[]}
    loading={state === 'loading'} loadError={state === 'failed' ? C.loadFailed : null}
    onOpenChange={vi.fn()} onSave={vi.fn()} />)
  expect(screen.getByRole('status')).toHaveTextContent(state === 'loading' ? C.loading : C.loadFailed)
  expect(screen.queryByText(C.unavailable)).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: upgradeLabel })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: C.save })).toBeDisabled()
})

it('offers an upgrade only for a confirmed unavailable cadence and accepts an allowed choice', () => {
  const save = vi.fn()
  render(<MonitoringScheduleEditor open schedule={{ every: 1, unit: 'days' }} availableIntervals={['weekly']}
    onOpenChange={vi.fn()} onSave={save} />)
  expect(screen.getByText(C.unavailable)).toBeVisible()
  expect(screen.getByRole('link', { name: upgradeLabel })).toHaveAttribute('href', '/pricing')
  expect(screen.getByRole('button', { name: C.save })).toBeDisabled()
  fireEvent.change(screen.getByRole('combobox', { name: C.frequency }), { target: { value: 'weekly' } })
  expect(screen.queryByRole('link', { name: upgradeLabel })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  expect(save).toHaveBeenCalledWith({ every: 1, unit: 'weeks' })
})

it('asks for a valid interval before suggesting a plan change', () => {
  render(<MonitoringScheduleEditor open schedule={{ every: 3, unit: 'hours' }} availableIntervals={['weekly']}
    onOpenChange={vi.fn()} onSave={vi.fn()} />)
  fireEvent.change(screen.getByRole('spinbutton', { name: C.every }), { target: { value: '1.5' } })
  expect(screen.getByText(C.invalid(61320))).toBeVisible()
  expect(screen.queryByRole('link', { name: upgradeLabel })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: C.save })).toBeDisabled()
})

it('preserves the sample editor callback without consulting plan options', () => {
  const save = vi.fn()
  render(<MonitoringScheduleEditor open sample schedule={{ every: 3, unit: 'hours' }} availableIntervals={[]}
    onOpenChange={vi.fn()} onSave={save} />)
  fireEvent.click(screen.getByRole('button', { name: C.updateSample }))
  expect(save).toHaveBeenCalledWith({ every: 3, unit: 'hours' })
  expect(screen.queryByRole('link', { name: upgradeLabel })).not.toBeInTheDocument()
})

it.each([
  { unit: 'hours' as const, maximum: 61320 },
  { unit: 'days' as const, maximum: 2555 },
  { unit: 'weeks' as const, maximum: 365 },
])('uses the saved monitoring duration limit for $unit and refuses larger values', ({ unit, maximum }) => {
  const save = vi.fn()
  render(<MonitoringScheduleEditor open schedule={{ every: maximum, unit }} availableIntervals={['custom']}
    onOpenChange={vi.fn()} onSave={save} />)
  const input = screen.getByRole('spinbutton', { name: C.every })
  expect(input).toHaveAttribute('max', String(maximum))
  expect(screen.getByRole('button', { name: C.save })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  expect(save).toHaveBeenCalledExactlyOnceWith({ every: maximum, unit })
  fireEvent.change(input, { target: { value: String(maximum + 1) } })
  expect(screen.getByText(C.invalid(maximum))).toBeVisible()
  expect(screen.getByRole('button', { name: C.save })).toBeDisabled()
  fireEvent.submit(input.closest('form')!)
  expect(save).toHaveBeenCalledOnce()
})

it('preserves the sample preview range and exact validation wording', () => {
  const save = vi.fn()
  render(<MonitoringScheduleEditor open sample schedule={{ every: 366, unit: 'hours' }} availableIntervals={[]}
    onOpenChange={vi.fn()} onSave={save} />)
  expect(screen.getByRole('spinbutton', { name: C.every })).toHaveAttribute('max', '365')
  expect(screen.getByText('Choose a whole number between 1 and 365.')).toBeVisible()
  expect(screen.getByRole('button', { name: C.updateSample })).toBeDisabled()
  expect(save).not.toHaveBeenCalled()
})

it.each(['interval', 'unit', 'cancel'] as const)('keeps intentional %s focus and the custom draft when retried options arrive', target => {
  const props = { open: true, schedule: { every: 3, unit: 'hours' as const }, availableIntervals: [],
    onOpenChange: vi.fn(), onSave: vi.fn(), onRetry: vi.fn() }
  const rendered = render(<MonitoringScheduleEditor {...props} loadError={C.loadFailed} />)
  const retry = screen.getByRole('button', { name: C.retry })
  retry.focus()
  fireEvent.click(retry)
  rendered.rerender(<MonitoringScheduleEditor {...props} loading />)
  const control = target === 'interval' ? screen.getByRole('spinbutton', { name: C.every })
    : target === 'unit' ? screen.getByRole('combobox', { name: C.unit }) : screen.getByRole('button', { name: C.cancel })
  fireEvent.change(screen.getByRole('spinbutton', { name: C.every }), { target: { value: '5' } })
  control.focus()
  rendered.rerender(<MonitoringScheduleEditor {...props} availableIntervals={['custom']} />)
  expect(control).toHaveFocus()
  expect(screen.getByRole('spinbutton', { name: C.every })).toHaveValue(5)
  expect(props.onSave).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: C.save }))
  expect(props.onSave).toHaveBeenCalledWith({ every: 5, unit: 'hours' })
})
