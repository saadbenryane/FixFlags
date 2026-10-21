import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Local native transport fixtures share certificates, never relaxed TLS checks. */
export function createTestTlsCertificates() {
  const database = new URL(process.env.DATABASE_URL ?? '')
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_(?:execution|uptime)_test_[a-f0-9]{32}$/.test(database.pathname))
    throw new Error('Use a disposable execution verifier')
  const directory = mkdtempSync(join(tmpdir(), 'fixflags-test-tls-'))
  const file = (name: string) => join(directory, name)
  const openssl = (...args: string[]) => execFileSync('openssl', args, { stdio: 'ignore' })
  try {
    openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=Disposable fixture CA',
      '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', file('ca.key'), '-out', file('ca.pem'))
    openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=example.com', '-keyout', file('server.key'), '-out', file('server.csr'))
    writeFileSync(file('index'), ''); writeFileSync(file('serial'), '1000\n')
    writeFileSync(file('ca.cnf'), '[ca]\ndefault_ca=fixture\n[fixture]\n' +
      `database=${file('index')}\nserial=${file('serial')}\nnew_certs_dir=${directory}\nprivate_key=${file('ca.key')}\ncertificate=${file('ca.pem')}\n` +
      'default_md=sha256\npolicy=policy\nunique_subject=no\n[policy]\ncommonName=supplied\n')
    const certificates: Record<string, Buffer> = {}
    for (const kind of ['valid', 'expired', 'mismatch'] as const) {
      writeFileSync(file('extensions.cnf'), 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:' +
        (kind === 'mismatch' ? 'other.example.com' : 'example.com') + '\n')
      if (kind === 'expired') openssl('ca', '-batch', '-notext', '-config', file('ca.cnf'), '-in', file('server.csr'),
        '-startdate', '20200101000000Z', '-enddate', '20200102000000Z', '-extfile', file('extensions.cnf'), '-out', file(kind + '.pem'))
      else openssl('x509', '-req', '-in', file('server.csr'), '-CA', file('ca.pem'), '-CAkey', file('ca.key'), '-CAcreateserial',
        '-days', '1', '-extfile', file('extensions.cnf'), '-out', file(kind + '.pem'))
      certificates[kind] = readFileSync(file(kind + '.pem'))
    }
    openssl('req', '-x509', '-key', file('server.key'), '-days', '1', '-subj', '/CN=example.com',
      '-addext', 'subjectAltName=DNS:example.com', '-out', file('self-signed.pem'))
    certificates['self-signed'] = readFileSync(file('self-signed.pem'))
    return { key: readFileSync(file('server.key')), ca: readFileSync(file('ca.pem')), certificates,
      dispose: () => rmSync(directory, { recursive: true, force: true }) }
  } catch (error) { rmSync(directory, { recursive: true, force: true }); throw error }
}
