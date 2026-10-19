import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PasswordInput } from '../PasswordInput'
import { AUTH } from '@/lib/marketing/copy'

describe('password visibility action', () => {
  it('changes visibility without submitting or losing its label, value and error association', () => {
    const submit = vi.fn(event => event.preventDefault())
    render(<form onSubmit={submit}><PasswordInput label="Password" value="LocalDisplayProbe!" onChange={vi.fn()} error="Recorded validation error" /></form>)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAccessibleDescription('Recorded validation error')
    fireEvent.click(screen.getByRole('button', { name: AUTH.password.showLabel }))
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('LocalDisplayProbe!')
    expect(screen.getByRole('button', { name: AUTH.password.hideLabel })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: AUTH.password.hideLabel }))
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toHaveAccessibleDescription('Recorded validation error')
    expect(submit).not.toHaveBeenCalled()
  })
})
