import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getMadewithPage } from '@/lib/graph/queries'
import Link from 'next/link'

interface Props {
  params: Promise<{ hostname: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hostname } = await params
  const data = await getMadewithPage(hostname)
  if (!data) return { title: 'Not Found' }

  const techNames = data.techStack.map((t) => t.name).join(', ')
  const title = data.techStack.length > 0
    ? `${data.hostname} - Built with ${data.techStack[0].name} | FixFlags`
    : `${data.hostname} | FixFlags`
  const description = `Tech stack detected on ${data.hostname}: ${techNames}. Run a free audit to find issues.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  }
}

const KIND_LABELS: Record<string, string> = {
  framework: 'Framework',
  builder: 'Builder',
  cms: 'CMS',
  hosting: 'Hosting',
  analytics: 'Analytics',
}

const KIND_ORDER = ['framework', 'builder', 'cms', 'hosting', 'analytics']

export default async function MadewithPage({ params }: Props) {
  const { hostname } = await params
  const data = await getMadewithPage(hostname)

  if (!data) notFound()

  const groupedTech = KIND_ORDER
    .map((kind) => ({
      kind,
      label: KIND_LABELS[kind] ?? kind,
      items: data.techStack.filter((t) => t.kind === kind),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <Container variant="default" className="py-16 md:py-24">
      {/* Hero */}
      <div className="text-center mb-12">
        <p className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
          Built with
        </p>
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
          {data.hostname}
        </h1>
        {data.techStack.length > 0 && (
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Detected tech stack:{' '}
            {data.techStack.map((t) => t.name).join(', ')}
          </p>
        )}
        {data.industry && (
          <Badge variant="secondary" size="md" className="mt-4">
            {data.industry}
          </Badge>
        )}
      </div>

      {/* Tech Stack Grid */}
      {groupedTech.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {groupedTech.map((group) => (
            <Card key={group.kind} variant="solid">
              <CardContent className="p-6">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  {group.label}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((tech) => (
                    <Badge key={tech.name} variant="outline" size="md">
                      {tech.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Audit Summary */}
      {data.lastAudit && (
        <Card variant="solid" className="mb-12">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Last Audit
                </h2>
                <p className="text-sm text-muted-foreground">
                  {data.lastAudit.completedAt.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {' '}
                  &middot;{' '}
                  {data.lastAudit.flagCount} {data.lastAudit.flagCount === 1 ? 'issue' : 'issues'} found
                </p>
              </div>
              <div className="flex items-center gap-4">
                {data.lastAudit.score !== null && (
                  <div className="text-center">
                    <div className="text-3xl font-bold text-foreground">
                      {data.lastAudit.score}
                    </div>
                    <div className="text-xs text-muted-foreground">Score</div>
                  </div>
                )}
                <Button asChild variant="default" size="sm">
                  <Link href={`/?url=${encodeURIComponent(data.rootUrl)}`}>
                    Run Free Audit
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Sites */}
      {data.relatedSites.length > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Sites Using the Same Stack
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.relatedSites.map((site) => (
              <Link
                key={site.hostname}
                href={`/madewith/${site.hostname}`}
                className="block"
              >
                <Card variant="solid" interactive>
                  <CardContent className="p-4">
                    <p className="font-medium text-foreground mb-2">
                      {site.hostname}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {site.techNames.map((name) => (
                        <Badge key={name} variant="secondary" size="sm">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="text-center pt-8 border-t border-border/30">
        <p className="text-muted-foreground mb-4">
          Curious about your own site?
        </p>
        <Button asChild variant="default" size="lg">
          <Link href="/">
            Run a Free Audit
          </Link>
        </Button>
      </div>
    </Container>
  )
}
