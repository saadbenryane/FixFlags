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
    HIGH: 'text-grade-D bg-grade-D/12',
    MEDIUM: 'text-grade-C bg-grade-C/12',
    LOW: 'text-blue-600 bg-blue-500/12 dark:text-blue-400',
    INFO: 'text-muted-foreground bg-muted',
  }
  return map[severity] ?? 'text-muted-foreground bg-muted'
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
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

export function areaLabel(name: string): string {
  const map: Record<string, string> = {
    PERFORMANCE: 'Performance',
    ACCESSIBILITY: 'Accessibility',
    SEO: 'SEO',
    CONVERSION: 'Conversion',
    TRUST: 'Trust',
    CONTENT: 'Content',
    MOBILE: 'Mobile',
  }
  return map[name] ?? name
}

export function scoreTypeLabel(name: string): { label: string; badge: string } {
  const objective = ['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'MOBILE']
  if (objective.includes(name)) {
    return { label: '0–100', badge: 'Objective check' }
  }
  return { label: 'A–F', badge: 'Experience check' }
}
