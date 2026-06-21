
export interface CheckMessageEntry {
  problem: string
  evidence: string
  fix: string
}

const MESSAGES: Record<string, Record<string, CheckMessageEntry>> = {}

function getOrCreate(checkId: string, severity: string): CheckMessageEntry {
  MESSAGES[checkId] ??= {}
  MESSAGES[checkId][severity] ??= { problem: '', evidence: '', fix: '' }
  return MESSAGES[checkId][severity]
}

export function registerMessage(
  checkId: string,
  severity: string,
  entry: CheckMessageEntry
): void {
  Object.assign(getOrCreate(checkId, severity), entry)
}

export function getMessage(checkId: string, severity: string): CheckMessageEntry | null {
  return MESSAGES[checkId]?.[severity] ?? null
}

export function getAllMessages(): typeof MESSAGES {
  return MESSAGES
}
