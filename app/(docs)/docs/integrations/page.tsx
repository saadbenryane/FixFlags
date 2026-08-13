import Link from 'next/link'
import { ArrowUpRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { DocsCodeBlock } from '@/components/docs/DocsCodeBlock'
import { DocsConnectAction } from '@/components/docs/DocsConnectAction'
import { DocsPageFrame } from '@/components/docs/DocsPageFrame'
import { EditorIntegrationGrid } from '@/components/marketing/landing/EditorIntegrationGrid'
import { Button } from '@/components/ui/button'
import { buildDocsMetadata, getDocsPage } from '@/lib/docs/catalog'
import { EDITOR_INTEGRATIONS } from '@/lib/integrations/editor-catalog'
import {
  buildEditorMcpConfiguration,
  getMcpEndpoint,
} from '@/lib/integrations/editor-config'

const page = getDocsPage('integrations')
export const metadata = buildDocsMetadata(page)

const FIRST_PROMPT =
  'Check https://your-product.com and build a Finish Plan. Validate the highest-ranked Flag against its evidence before changing code. After I deploy the fix, run an update review and compare against the original report.'

export default function IntegrationsDocsPage() {
  return (
    <DocsPageFrame page={page}>
      <div className="space-y-16">
        <EditorIntegrationGrid variant="docs" className="mb-4" />

        <section id="quick-start" className="scroll-mt-32">
          <h2 className="font-serif text-3xl font-semibold tracking-display">Quick start</h2>
          <p className="mt-4 max-w-2xl leading-8 text-muted-foreground">
            Choose an editor below. The public example uses a placeholder. The authenticated
            setup creates a client-tagged key, reveals it once, and validates the versioned core.
          </p>
          <dl className="mt-6 grid gap-4 rounded-[var(--radius-card)] bg-muted/45 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-label text-muted-foreground">
                Endpoint
              </dt>
              <dd className="mt-1 break-all font-mono text-sm">{getMcpEndpoint()}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-label text-muted-foreground">
                Transport and auth
              </dt>
              <dd className="mt-1 text-sm">Streamable HTTP · Bearer token</dd>
            </div>
          </dl>
        </section>

        {EDITOR_INTEGRATIONS.map((editor) => {
          const config = buildEditorMcpConfiguration(editor.key)
          return (
            <section
              key={editor.key}
              id={editor.docsAnchor}
              className="scroll-mt-32 border-t border-border/60 pt-14"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs font-semibold uppercase tracking-label text-brand">
                    {editor.setupMode === 'local-config' ? 'Local configuration' : 'Hosted connector'}
                  </p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold tracking-display">
                    {editor.label}
                  </h2>
                </div>
                <a
                  href={editor.officialDocsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  Official docs
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              </div>

              <ol className="mt-7 space-y-5 text-base leading-8">
                <li>
                  <strong>1. Open the setup location.</strong>
                  <span className="mt-1 block text-muted-foreground">{editor.setupLocation}</span>
                </li>
                <li>
                  <strong>2. Add FixFlags.</strong>
                  <span className="mt-1 block text-muted-foreground">
                    Use the authenticated action below for a real key. Keep the key in the
                    platform&apos;s secret store or environment.
                  </span>
                </li>
              </ol>

              <DocsCodeBlock code={config.value} label={config.label} />

              <div className="rounded-[var(--radius-card)] border border-border/60 p-5">
                <p className="text-xs font-semibold uppercase tracking-label text-muted-foreground">
                  First workflow
                </p>
                <p className="mt-3 font-mono text-sm leading-7 text-foreground/90">{FIRST_PROMPT}</p>
              </div>

              <p className="mt-5 flex gap-2 text-sm leading-6 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                Success means {editor.label} discovers the Contract v1 core and can start
                `ff_check_and_plan`. Optional capabilities are advertised by `ff_get_connection_info`.
              </p>
              <DocsConnectAction editorKey={editor.key} />
            </section>
          )
        })}

        <section id="other-mcp-client" className="scroll-mt-32 border-t border-border/60 pt-14">
          <p className="font-mono text-xs font-semibold uppercase tracking-label text-brand">
            Generic Streamable HTTP
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold tracking-display">
            Other MCP client
          </h2>
          <p className="mt-4 max-w-2xl leading-8 text-muted-foreground">
            Use this path when your client is not listed above. Add the FixFlags endpoint as a
            Streamable HTTP server, store the credential as a secret, and send it with the Bearer
            authorization scheme.
          </p>
          <DocsCodeBlock
            label="Generic MCP connection"
            code={`Name: FixFlags\nURL: ${getMcpEndpoint()}\nTransport: Streamable HTTP\nAuthorization: Bearer ff_live_your_key_here\n`}
          />
          <p className="mt-5 flex gap-2 text-sm leading-6 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            Validate the Contract v1 core with `ff_get_connection_info`. Additional tools are
            optional capabilities and may be added without breaking the connection.
          </p>
          <Button asChild variant="brand" className="mt-6">
            <Link href="/dashboard/mcp-setup?builder=other&returnTo=%2Fdocs%2Fintegrations%23other-mcp-client">
              Connect another MCP client
            </Link>
          </Button>
        </section>

        <section id="verify" className="scroll-mt-32 border-t border-border/60 pt-14">
          <h2 className="font-serif text-3xl font-semibold tracking-display">
            Verify the connection
          </h2>
          <p className="mt-4 leading-8 text-muted-foreground">
            Restart the editor after changing its configuration, then use the setup wizard&apos;s
            discovery test. The connection is ready when every Contract v1 core tool is present;
            optional capabilities are reported separately.
          </p>
          <p className="mt-4">
            See the <Link className="font-medium text-link underline" href="/docs/mcp/tools">tool reference</Link>{' '}
            for the canonical public list.
          </p>
        </section>

        <section id="security" className="scroll-mt-32 border-t border-border/60 pt-14">
          <h2 className="font-serif text-3xl font-semibold tracking-display">
            Keep credentials safe
          </h2>
          <p className="mt-4 flex gap-3 leading-8 text-muted-foreground">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-brand" aria-hidden />
            API keys never belong in public HTML, analytics, logs, URLs, or project-tracked files.
            Revoke and replace any key that may have been exposed.
          </p>
        </section>

        <section id="troubleshooting" className="scroll-mt-32 border-t border-border/60 pt-14">
          <h2 className="font-serif text-3xl font-semibold tracking-display">Troubleshooting</h2>
          <p className="mt-4 leading-8 text-muted-foreground">
            If authentication fails, tools are missing, or the editor rejects its config, follow
            the <Link className="font-medium text-link underline" href="/docs/troubleshooting">troubleshooting guide</Link>.
          </p>
        </section>
      </div>
    </DocsPageFrame>
  )
}
