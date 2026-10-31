type Value = string | number | boolean
export type SettingsValues = Record<string, Value>
type Draft = Partial<SettingsValues>

// Tab memory only. Passwords, tokens and evidence never enter this store.
let owner: string | null = null
let generation = 0
const drafts = new Map<string, Draft>()

function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
function updateUnloadGuard() {
  if (typeof window === 'undefined') return
  window.removeEventListener('beforeunload', beforeUnload)
  if (drafts.size) window.addEventListener('beforeunload', beforeUnload)
}

export function clearSettingsDrafts() {
  owner = null
  generation++
  drafts.clear()
  updateUnloadGuard()
}

export function activateSettingsDrafts(userId: string) {
  if (owner !== userId) { clearSettingsDrafts(); owner = userId }
  return generation
}

export function readSettingsDraft<T extends SettingsValues>(userId: string, form: string, saved: T): T {
  return { ...saved, ...(owner === userId ? drafts.get(form) : undefined) }
}

export function writeSettingsDraft<T extends SettingsValues>(userId: string, expectedGeneration: number, form: string, saved: T, values: T) {
  if (owner !== userId || generation !== expectedGeneration) return false
  const patch = Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== saved[key]))
  if (Object.keys(patch).length) drafts.set(form, patch)
  else drafts.delete(form)
  updateUnloadGuard()
  return true
}
