import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/db'
import { gradeFromScore } from '@/lib/audit/scoring'
import { BRAND } from '@/lib/marketing/copy'

export const runtime = 'nodejs'
export const alt = 'QualityOS audit report'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function scoreColor(score: number): string {
  const grade = gradeFromScore(score)
  if (grade === 'A') return '#22c55e'
  if (grade === 'B') return '#84cc16'
  if (grade === 'C') return '#f59e0b'
  if (grade === 'D') return '#f97316'
  return '#ef4444'
}

function genericOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0a0a0a',
          padding: '64px 72px',
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: '#22c55e',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: 'monospace',
          }}
        >
          {BRAND.name}
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color: '#ffffff', textAlign: 'center' }}>
          Automated quality audit
        </div>
        <div style={{ fontSize: 22, color: '#737373', textAlign: 'center' }}>
          Performance · SEO · Conversion · Trust · Mobile
        </div>
      </div>
    ),
    { ...size }
  )
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: {
      url: true,
      score: true,
      verdict: true,
      status: true,
      isPublic: true,
      userId: true,
      areas: {
        select: {
          findings: {
            select: { severity: true, problem: true },
            orderBy: { position: 'asc' },
            take: 3,
          },
        },
      },
    },
  })

  const isShareableOg = audit?.isPublic || audit?.userId === null
  if (!audit || audit.status !== 'COMPLETED' || !isShareableOg) {
    return genericOgImage()
  }

  const hostname = audit.url
    ? (() => {
        try {
          return new URL(audit.url).hostname
        } catch {
          return audit.url
        }
      })()
    : 'yoursite.com'

  const score = audit.score ?? null
  const topIssue =
    audit.areas
      ?.flatMap((a) => a.findings)
      .find((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL')?.problem ??
    audit.verdict?.slice(0, 80) ??
    'Automated quality audit'

  const color = score != null ? scoreColor(score) : '#737373'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0a',
          padding: '64px 72px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: '#22c55e',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}
          >
            QualityOS
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#ffffff' }}>{hostname}</div>
          <div style={{ fontSize: 22, color: '#a3a3a3', maxWidth: 900, lineHeight: 1.4 }}>
            {topIssue}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 20, color: '#737373' }}>Want your own audit?</div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              backgroundColor: '#141414',
              borderRadius: 16,
              padding: '28px 40px',
              border: '1px solid #262626',
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                color,
                fontFamily: 'monospace',
                lineHeight: 1,
              }}
            >
              {score ?? '-'}
            </div>
            <div style={{ fontSize: 18, color: '#525252', fontFamily: 'monospace' }}>/ 100</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
