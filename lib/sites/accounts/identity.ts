import { createHash, randomBytes } from 'node:crypto'

export function testIdentity(base: string, id: string) {
  const [local, domain] = base.toLowerCase().split('@')
  if (!local || !domain || local.includes('+') || !/^[a-zA-Z0-9_-]{8,80}$/.test(id)) throw new Error('Invalid test identity')
  return { email: `${local}+ff-${id}@${domain}`, password: `Ff!${randomBytes(24).toString('base64url')}9a` }
}
export function flowFingerprint(flow: { url: string; action: string; fields: Array<{ type: string; name: string; label: string; autocomplete: string; required: boolean }> }) {
  return createHash('sha256').update(JSON.stringify({ url: new URL(flow.url).pathname,
    action: new URL(flow.action, flow.url).pathname, fields: flow.fields.map(({ type, name, label, autocomplete, required }) => ({ type, name, label: label.trim().toLowerCase(), autocomplete, required })) })).digest('hex')
}
