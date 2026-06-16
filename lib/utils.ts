import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A: 'text-grade-A bg-grade-A/10 border-grade-A/25',
    B: 'text-grade-B bg-grade-B/10 border-grade-B/25',
    C: 'text-grade-C bg-grade-C/10 border-grade-C/25',
    D: 'text-grade-D bg-grade-D/10 border-grade-D/25',
    F: 'text-grade-F bg-grade-F/10 border-grade-F/25',
  }
  return map[grade] ?? 'text-muted-foreground bg-muted border-border'
}

export function severityColor(severity: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'text-destructive bg-destructive/12',
    IMPORTANT: 'text-grade-D bg-grade-D/12',
    POLISH: 'text-grade-C bg-grade-C/12',
  }
  return map[severity] ?? 'text-muted-foreground bg-muted'
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  IMPORTANT: 1,
  POLISH: 2,
}

const GRADE_ORDER: Record<string, number> = {
  F: 0,
  D: 1,
  C: 2,
  B: 3,
  A: 4,
}

export function severityRank(severity: string): number {
  return SEVERITY_ORDER[severity] ?? 99
}

export function gradeRank(grade: string): number {
  return GRADE_ORDER[grade] ?? 99
}

export function rubricLabel(name: string): string {
  const map: Record<string, string> = {
    MESSAGE: 'Message',
    EXPERIENCE: 'Experience',
    REACH: 'Reach',
  }
  return map[name] ?? name
}

export function rubricDescription(name: string): string {
  const map: Record<string, string> = {
    MESSAGE:
      'Does the page make sense and feel credible? Copy, headline, positioning, audience, benefits, social proof, and trust signals.',
    EXPERIENCE:
      'Does the page work well for users? Design, layout, mobile, accessibility, speed, polish, and broken interactions.',
    REACH:
      'Can people find, share, and measure it? SEO, metadata, share previews, analytics, and conversion tracking.',
  }
  return map[name] ?? ''
}

export function severityLabel(severity: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'Critical',
    IMPORTANT: 'Important',
    POLISH: 'Polish',
  }
  return map[severity] ?? severity
}

export function impactTagLabel(tag: string | null | undefined): string | null {
  if (!tag) return null
  const map: Record<string, string> = {
    CONVERSION: 'Conversion',
    REVENUE: 'Revenue',
    TRUST: 'Trust',
    MEASUREMENT: 'Measurement',
    SHARING: 'Sharing',
    SEO: 'SEO',
    ACCESSIBILITY: 'Accessibility',
  }
  return map[tag] ?? tag
}

export function flagStatusLabel(status: string): string {
  const map: Record<string, string> = {
    OPEN: 'Open',
    FIXED: 'Fixed',
    IGNORED: 'Ignored',
    REGRESSED: 'Regressed',
  }
  return map[status] ?? status
}

export function rubricStatusColor(status: string): string {
  const map: Record<string, string> = {
    PASS: 'text-grade-A bg-grade-A/10 border-grade-A/25',
    NEEDS_ATTENTION: 'text-grade-C bg-grade-C/10 border-grade-C/25',
    BLOCKED: 'text-grade-F bg-grade-F/10 border-grade-F/25',
  }
  return map[status] ?? 'text-muted-foreground bg-muted border-border'
}

export function shareStatusLabel(status: string): string {
  const map: Record<string, string> = {
    good_to_share: 'Good to share',
    fix_before_sharing: 'Fix before sharing',
  }
  return map[status] ?? status
}

export function shareStatusColor(status: string): string {
  const map: Record<string, string> = {
    good_to_share: 'text-grade-A bg-grade-A/10 border-grade-A/25',
    fix_before_sharing: 'text-grade-F bg-grade-F/10 border-grade-F/25',
  }
  return map[status] ?? 'text-muted-foreground bg-muted border-border'
}
