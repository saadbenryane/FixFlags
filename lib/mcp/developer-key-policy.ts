import type { McpScope } from '@/lib/mcp/tool-manifest'

export const DEVELOPER_KEY_SCOPE_PRESETS = [
  {
    id: 'read_only',
    label: 'Read evidence',
    description: 'List Sites, Outcomes, runs, and Flags without starting or changing anything.',
    scopes: ['sites:read', 'runs:read', 'flags:read'],
  },
  {
    id: 'run_checks',
    label: 'Run checks',
    description: 'Read evidence and start independent Outcome runs. Cannot record or verify a fix.',
    scopes: ['sites:read', 'runs:read', 'runs:write', 'flags:read'],
  },
  {
    id: 'fix_and_verify',
    label: 'Fix and verify',
    description: 'Use the complete Flag → Fix → Verify workflow for Sites this account owns.',
    scopes: ['sites:read', 'runs:read', 'runs:write', 'flags:read', 'flags:write'],
  },
] as const satisfies ReadonlyArray<{
  id: string
  label: string
  description: string
  scopes: readonly McpScope[]
}>

export type DeveloperKeyScopePreset = (typeof DEVELOPER_KEY_SCOPE_PRESETS)[number]['id']

export const DEFAULT_DEVELOPER_KEY_SCOPE_PRESET: DeveloperKeyScopePreset = 'read_only'
export const DEVELOPER_KEY_EXPIRY_DAYS = [30, 90, 365] as const
export type DeveloperKeyExpiryDays = (typeof DEVELOPER_KEY_EXPIRY_DAYS)[number]
export const DEFAULT_DEVELOPER_KEY_EXPIRY_DAYS: DeveloperKeyExpiryDays = 90

export function developerKeyPreset(value: unknown) {
  if (value != null && typeof value !== 'string') return null
  const id = value ?? DEFAULT_DEVELOPER_KEY_SCOPE_PRESET
  return DEVELOPER_KEY_SCOPE_PRESETS.find((preset) => preset.id === id) ?? null
}

export function developerKeyExpiryDays(value: unknown): DeveloperKeyExpiryDays | null {
  const days = value == null ? DEFAULT_DEVELOPER_KEY_EXPIRY_DAYS : value
  return DEVELOPER_KEY_EXPIRY_DAYS.find((candidate) => candidate === days) ?? null
}

export function developerKeyExpiresAt(days: DeveloperKeyExpiryDays, now = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
}

export function developerKeyScopeLabel(scopes: readonly string[]): string {
  if (scopes.length === 0) return 'Legacy full access'
  const normalized = [...new Set(scopes)].sort().join(' ')
  const preset = DEVELOPER_KEY_SCOPE_PRESETS.find((candidate) => [...candidate.scopes].sort().join(' ') === normalized)
  return preset?.label ?? 'Custom access'
}
