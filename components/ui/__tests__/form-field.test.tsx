import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'

describe('Field', () => {
  it('connects its label and supporting description to the control', () => {
    render(
      <Field label="Project name" description="Shown in your dashboard.">
        {(props) => <Input {...props} />}
      </Field>
    )

    const input = screen.getByRole('textbox', { name: 'Project name' })
    const description = screen.getByText('Shown in your dashboard.')
    expect(input).toHaveAttribute('aria-describedby', description.id)
  })

  it('marks invalid controls and announces their error', () => {
    render(
      <Field label="Email" error="Enter a valid email.">
        {(props) => <Input {...props} type="email" />}
      </Field>
    )

    const input = screen.getByRole('textbox', { name: 'Email' })
    const error = screen.getByRole('alert')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', error.id)
  })
})
