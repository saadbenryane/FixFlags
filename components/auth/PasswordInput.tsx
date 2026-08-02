'use client'

import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconInput } from '@/components/ui/icon-input'
import { AUTH } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface PasswordInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  minLength?: number
  showRequirements?: boolean
  error?: string
  autoComplete?: string
}

export function PasswordInput({
  label,
  value,
  onChange,
  required = true,
  minLength = 8,
  showRequirements = false,
  error,
  autoComplete = 'current-password',
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const hasMinLength = value.length >= minLength

  return (
    <div className="space-y-2">
      <div className="relative">
        <IconInput
          type={visible ? 'text' : 'password'}
          label={label}
          icon={<Lock className="h-4 w-4" />}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          error={error}
          autoComplete={autoComplete}
          className="pr-11"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-1 top-2.5 h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={visible ? AUTH.password.hideLabel : AUTH.password.showLabel}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      {showRequirements && (
        <ul className="list-none space-y-1 px-1 text-xs text-muted-foreground">
          <li className={cn(hasMinLength && 'text-foreground')}>
            {hasMinLength ? '✓' : '○'} {AUTH.password.minLength(minLength)}
          </li>
        </ul>
      )}
    </div>
  )
}
