import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A: 'text-green-600 bg-green-50 border-green-200',
    B: 'text-lime-600 bg-lime-50 border-lime-200',
    C: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    D: 'text-orange-600 bg-orange-50 border-orange-200',
    F: 'text-red-600 bg-red-50 border-red-200',
  }
  return map[grade] ?? 'text-gray-600 bg-gray-50 border-gray-200'
}

export function severityColor(severity: string): string {
  const map: Record<string, string> = {
    CRITICAL: 'text-red-700 bg-red-100',
    HIGH: 'text-orange-700 bg-orange-100',
    MEDIUM: 'text-yellow-700 bg-yellow-100',
    LOW: 'text-blue-700 bg-blue-100',
    INFO: 'text-gray-700 bg-gray-100',
  }
  return map[severity] ?? 'text-gray-700 bg-gray-100'
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
